import autoAssignOverlayPositionAndSize from '../utils/position';

interface OverlayWrapper {
  overlay: HTMLDivElement;
  target: HTMLElement | null;
  index?: number;
}

export enum OverlayType {
  SELECTION = 'selection',
  HOVER = 'hover',
}

// defines common class for overlay elements
const OVERLAY_BASE_CLASS = 'mcp-pointer__overlay';
const OVERLAY_CONFIG = {
  [OverlayType.SELECTION]: {
    typeClassName: 'mcp-pointer__overlay--selection',
    hasGlow: true,
    hasGlass: true,
  },
  [OverlayType.HOVER]: {
    typeClassName: 'mcp-pointer__overlay--hover',
    hasGlow: false,
    hasGlass: true,
  },
};

export default class OverlayManagerService {
  private overlayWrappers = new Map<OverlayType | string, OverlayWrapper>();
  private selectionOverlays = new Map<HTMLElement, OverlayWrapper>();

  overlay(type: OverlayType, target: HTMLElement, index?: number): void {
    if (type === OverlayType.SELECTION) {
      this.assignTargetToOverlay(type, target, index);
      this.positionOverlay(type, target);
    } else {
      this.assignTargetToOverlay(type, target, index);
      this.positionOverlay(type);
    }
  }

  clearOverlay(type: OverlayType, target?: HTMLElement): void {
    if (type === OverlayType.SELECTION && target) {
      const wrapper = this.selectionOverlays.get(target);
      if (wrapper) {
        wrapper.overlay.remove();
        this.selectionOverlays.delete(target);
      }
    } else {
      const wrapper = this.overlayWrappers.get(type);
      const overlay = wrapper?.overlay;

      if (overlay) {
        overlay.remove();
        this.overlayWrappers.delete(type);
      }
    }
  }

  clearAllSelectionOverlays(): void {
    this.selectionOverlays.forEach((wrapper) => wrapper.overlay.remove());
    this.selectionOverlays.clear();
  }

  updateSelectionIndex(target: HTMLElement, newIndex: number): void {
    const wrapper = this.selectionOverlays.get(target);
    if (wrapper) {
      wrapper.index = newIndex;
      this.updateSelectionBadge(wrapper);
    }
  }

  private assignTargetToOverlay(type: OverlayType, target: HTMLElement, index?: number): void {
    if (type === OverlayType.SELECTION) {
      const existingWrapper = this.selectionOverlays.get(target);

      if (existingWrapper) {
        existingWrapper.index = index;
        this.updateSelectionBadge(existingWrapper);
        return;
      }

      const overlay = this.buildOverlayElement(type);
      const wrapper: OverlayWrapper = { overlay, target, index };
      this.selectionOverlays.set(target, wrapper);
      this.updateSelectionBadge(wrapper);
    } else {
      const wrapper = this.overlayWrappers.get(type);

      const overlay = wrapper?.overlay || this.buildOverlayElement(type);

      this.overlayWrappers.set(type, { overlay, target, index });
    }
  }

  private buildOverlayElement(type: OverlayType): HTMLDivElement {
    const overlayConfig = OVERLAY_CONFIG[type];
    const identifier = overlayConfig.typeClassName;
    const overlayClassName = `${OVERLAY_BASE_CLASS} ${identifier}`;

    const overlay = document.createElement('div');
    overlay.className = overlayClassName;

    // Build DOM structure based on type
    if (overlayConfig.hasGlow) {
      const glow = document.createElement('div');
      glow.className = 'mcp-pointer__overlay-glow';
      overlay.appendChild(glow);
    }

    if (overlayConfig.hasGlass) {
      const glass = document.createElement('div');
      glass.className = 'mcp-pointer__overlay-glass';
      if (type === OverlayType.SELECTION) {
        const indexElement = document.createElement('span');
        indexElement.className = 'mcp-pointer__overlay-index';
        indexElement.style.opacity = '0';
        indexElement.style.visibility = 'hidden';

        glass.appendChild(indexElement);
      }
      overlay.appendChild(glass);
    }

    document.body.appendChild(overlay);

    return overlay;
  }

  private positionOverlay(type: OverlayType, target?: HTMLElement): void {
    if (type === OverlayType.SELECTION && target) {
      const wrapper = this.selectionOverlays.get(target);
      const overlay = wrapper?.overlay;
      if (!overlay || !target) return;
      autoAssignOverlayPositionAndSize(target, overlay);
    } else {
      const wrapper = this.overlayWrappers.get(type);
      const overlay = wrapper?.overlay;
      const overlayTarget = wrapper?.target;

      if (!overlay || !overlayTarget) return;

      autoAssignOverlayPositionAndSize(overlayTarget, overlay);
    }
  }

  private updateSelectionBadge(wrapper: OverlayWrapper): void {
    const { overlay, target, index } = wrapper;
    if (!overlay || !target) return;

    const badge = overlay.querySelector('.mcp-pointer__overlay-index') as HTMLElement | null;
    if (!badge) return;

    const label = this.buildElementLabel(target);
    const pieces: string[] = [];

    if (typeof index === 'number' && Number.isFinite(index)) {
      pieces.push(index.toString());
    }

    if (label) {
      pieces.push(label.slice(-3));
    }

    badge.textContent = pieces.join(' · ');
    badge.style.opacity = pieces.length > 0 ? '1' : '0';
    badge.style.visibility = pieces.length > 0 ? 'visible' : 'hidden';
  }

  private buildElementLabel(element: HTMLElement): string {
    if (!element) return '';

    if (element.id) {
      return `#${element.id}`;
    }

    const className = Array.from(element.classList)
      .find((name) => !name.startsWith('mcp-pointer__'));

    if (className) {
      return `.${className}`;
    }

    return element.tagName.toLowerCase();
  }
}
