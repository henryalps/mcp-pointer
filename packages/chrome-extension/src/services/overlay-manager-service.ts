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
      const wrapper = this.selectionOverlays.get(target);
      if (!wrapper) {
        this.assignTargetToOverlay(type, target, index);
      }
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
      const indexElement = wrapper.overlay.querySelector('.mcp-pointer__overlay-index') as HTMLElement;
      if (indexElement) {
        indexElement.textContent = newIndex.toString();
        indexElement.style.opacity = '1';
        indexElement.style.visibility = 'visible';
      }
    }
  }

  private assignTargetToOverlay(type: OverlayType, target: HTMLElement, index?: number): void {
    if (type === OverlayType.SELECTION) {
      const wrapper = this.selectionOverlays.get(target);

      const overlay = wrapper?.overlay || this.buildOverlayElement(type, index);

      this.selectionOverlays.set(target, { overlay, target, index });
    } else {
      const wrapper = this.overlayWrappers.get(type);

      const overlay = wrapper?.overlay || this.buildOverlayElement(type, index);

      this.overlayWrappers.set(type, { overlay, target, index });
    }
  }

  private buildOverlayElement(type: OverlayType, index?: number): HTMLDivElement {
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
      if (type === OverlayType.SELECTION && index !== undefined) {
        const indexElement = document.createElement('span');
        indexElement.className = 'mcp-pointer__overlay-index';
        indexElement.textContent = index.toString();
        indexElement.style.opacity = '1';
        indexElement.style.visibility = 'visible';

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
}
