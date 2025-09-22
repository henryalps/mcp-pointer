import { TargetedElement } from '@mcp-pointer/shared/types';
import logger from '../utils/logger';
import TriggerMouseService from './trigger-mouse-service';
import TriggerKeyService from './trigger-key-service';
import OverlayManagerService, { OverlayType } from './overlay-manager-service';
import { adaptTargetToElement } from '../utils/element';

const POINTING_CLASS = 'mcp-pointer--is-pointing';

export default class ElementPointerService {
  private triggerKeyService: TriggerKeyService;

  private triggerMouseService: TriggerMouseService;

  private overlayManagerService: OverlayManagerService;

  private pointing: boolean = false;

  private hoveredElement: HTMLElement | null = null;

  private selectedElements: HTMLElement[] = [];

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

    if (this.selectedElements.includes(target)) {
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

    const index = this.selectedElements.indexOf(target);
    if (index !== -1) {
      // Deselecting
      this.selectedElements.splice(index, 1);
      this.overlayManagerService.clearOverlay(OverlayType.SELECTION, target);
      this.updateSelectionIndexes();
      this.overlayManagerService.overlay(OverlayType.HOVER, target);
      this.hoveredElement = target;
      this.sendToBackground();
    } else {
      // Selecting
      this.selectedElements.push(target);
      this.overlayManagerService.overlay(
        OverlayType.SELECTION,
        target,
        this.selectedElements.indexOf(target) + 1,
      );
      this.updateSelectionIndexes();
      this.overlayManagerService.clearOverlay(OverlayType.HOVER);
      this.hoveredElement = null;
      this.sendToBackground();
    }
  }

  public enable(): void {
    this.triggerKeyService.registerListeners();

    logger.info('✅ Element pointer enabled');
  }

  public disable(): void {
    this.overlayManagerService.clearOverlay(OverlayType.HOVER);
    this.overlayManagerService.clearAllSelectionOverlays();
    this.selectedElements = [];
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
    this.selectedElements.forEach((element, index) => {
      this.overlayManagerService.updateSelectionIndex(element, index + 1);
    });
  }

  private sendToBackground(): void {
    logger.info('📤 Sending selected elements to background:', this.selectedElements);

    // Send array of selected elements to background script
    chrome.runtime.sendMessage({
      type: 'ELEMENT_SELECTED',
      data: this.selectedElements.map(adaptTargetToElement) as TargetedElement[],
    }, (response: any) => {
      if (chrome.runtime.lastError) {
        logger.error('❌ Error sending to background:', chrome.runtime.lastError);
      } else {
        logger.debug('✅ Elements sent successfully:', response);
      }
    });
  }
}
