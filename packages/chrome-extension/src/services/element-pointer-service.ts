import { TargetedElement } from '@mcp-pointer/shared/types';
import logger from '../utils/logger';
import TriggerMouseService from './trigger-mouse-service';
import TriggerKeyService from './trigger-key-service';
import OverlayManagerService, { OverlayType } from './overlay-manager-service';
import { adaptTargetToElement } from '../utils/element';

const POINTING_CLASS = 'mcp-pointer--is-pointing';

interface SelectionRecord {
  element: HTMLElement;
  target: TargetedElement;
}

export default class ElementPointerService {
  private triggerKeyService: TriggerKeyService;

  private triggerMouseService: TriggerMouseService;

  private overlayManagerService: OverlayManagerService;

  private pointing: boolean = false;

  private hoveredElement: HTMLElement | null = null;

  private selectedRecords: SelectionRecord[] = [];

  private suppressBackgroundSync = false;

  constructor() {
    this.triggerKeyService = new TriggerKeyService({
      onTriggerKeyStart: this.startPointing.bind(this),
      onTriggerKeyEnd: this.stopPointing.bind(this),
    });
    this.triggerMouseService = new TriggerMouseService({
      onHover: this.onHover.bind(this),
      onClick: this.onClick.bind(this),
    });
    this.overlayManagerService = new OverlayManagerService();
  }

  private onHover(target: HTMLElement): void {
    if (this.hoveredElement === target) return;

    if (this.selectedRecords.some((record) => record.element === target)) {
      this.overlayManagerService.clearOverlay(OverlayType.HOVER);
      this.hoveredElement = null;
    } else {
      this.overlayManagerService.overlay(OverlayType.HOVER, target);
      this.hoveredElement = target;
    }
  }

  private onClick(target: HTMLElement, event: MouseEvent): void {
    if (!event.altKey || event.button !== 1) {
      return;
    }

    // Prevent default click behavior when option+middle clicking for selection
    event.preventDefault();
    event.stopPropagation();

    const index = this.selectedRecords.findIndex((record) => record.element === target);
    if (index !== -1) {
      // Deselecting
      const [removed] = this.selectedRecords.splice(index, 1);
      this.overlayManagerService.clearOverlay(OverlayType.SELECTION, removed.element);
      this.updateSelectionState();
      this.overlayManagerService.overlay(OverlayType.HOVER, target);
      this.hoveredElement = target;
    } else {
      // Selecting
      const newTarget = adaptTargetToElement(target, this.selectedRecords.length + 1);
      this.selectedRecords.push({ element: target, target: newTarget });
      this.overlayManagerService.overlay(
        OverlayType.SELECTION,
        target,
        newTarget.idx ?? this.selectedRecords.length,
      );
      this.updateSelectionState();
      this.overlayManagerService.clearOverlay(OverlayType.HOVER);
      this.hoveredElement = null;
    }
  }

  public enable(): void {
    this.triggerKeyService.registerListeners();

    logger.info('✅ Element pointer enabled');
  }

  public disable(): void {
    this.overlayManagerService.clearOverlay(OverlayType.HOVER);
    this.overlayManagerService.clearAllSelectionOverlays();
    this.selectedRecords = [];
    this.hoveredElement = null;

    this.triggerKeyService.unregisterListeners();

    logger.info('⏸️ Element pointer disabled');
  }

  private startPointing(): void {
    if (this.pointing) return;

    this.triggerMouseService.registerListeners();

    // document cursor pointer
    document.body.classList.add(POINTING_CLASS);

    this.pointing = true;
    logger.debug('Pointing started');
  }

  private stopPointing(): void {
    if (!this.pointing) return;

    this.triggerMouseService.unregisterListeners();
    this.overlayManagerService.clearOverlay(OverlayType.HOVER);

    // document cursor pointer
    document.body.classList.remove(POINTING_CLASS);

    this.pointing = false;
    logger.debug('Pointing stopped');
  }

  private updateSelectionIndexes(): void {
    this.selectedRecords.forEach((record, index) => {
      const displayIndex = record.target.idx ?? (index + 1);
      this.overlayManagerService.updateSelectionIndex(record.element, displayIndex);
    });
  }

  private rebuildTargets(): void {
    this.selectedRecords = this.selectedRecords.map((record, index) => {
      const updated = adaptTargetToElement(record.element, index + 1);
      const existingIdx = record.target.idx;
      return {
        element: record.element,
        target: {
          ...updated,
          idx: existingIdx ?? updated.idx,
          timestamp: record.target.timestamp ?? updated.timestamp,
        },
      };
    });
  }

  private sendSelectionsToBackground(targets: TargetedElement[]): void {
    logger.info('📤 Sending selected elements to background:', targets);

    chrome.runtime.sendMessage({
      type: 'ELEMENT_SELECTED',
      data: targets,
    }, (response: any) => {
      if (chrome.runtime.lastError) {
        logger.error('❌ Error sending to background:', chrome.runtime.lastError);
      } else {
        logger.debug('✅ Elements sent successfully:', response);
      }
    });
  }

  private updateSelectionState(options: { notifyBackground?: boolean } = {}): void {
    const { notifyBackground = true } = options;

    this.updateSelectionIndexes();
    this.rebuildTargets();

    if (!notifyBackground || this.suppressBackgroundSync) {
      return;
    }

    const targets = this.selectedRecords.map((record) => record.target);
    this.sendSelectionsToBackground(targets);
  }

  public syncSelectionsFromBackground(targets: TargetedElement[]): void {
    this.suppressBackgroundSync = true;

    this.overlayManagerService.clearOverlay(OverlayType.HOVER);
    this.overlayManagerService.clearAllSelectionOverlays();
    this.selectedRecords = [];
    this.hoveredElement = null;

    const sortedTargets = [...targets].sort((a, b) => a.idx - b.idx);

    sortedTargets.forEach((target) => {
      try {
        const element = document.querySelector(target.selector) as HTMLElement | null;
        if (!element) {
          logger.debug('未找到需要同步的元素:', target.selector);
          return;
        }

        this.overlayManagerService.overlay(OverlayType.SELECTION, element, target.idx);
        this.selectedRecords.push({
          element,
          target: { ...target },
        });
      } catch (error) {
        logger.debug('无法同步选中元素:', error);
      }
    });

    this.updateSelectionState({ notifyBackground: false });
    this.suppressBackgroundSync = false;
  }
}
