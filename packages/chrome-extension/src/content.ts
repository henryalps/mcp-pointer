// Content script - has access to both React Fiber and Chrome APIs in ISOLATED world
import ConfigStorageService from './services/config-storage-service';
import ElementPointerService from './services/element-pointer-service';
import logger from './utils/logger';

logger.debug('🌍 MCP Pointer content script loaded');

let pointer: ElementPointerService | null = null;

// Initialize pointer based on config
async function initializePointer() {
  try {
    const config = await ConfigStorageService.load();

    if (!pointer) {
      pointer = new ElementPointerService();

      if (IS_DEV) {
        // Export for potential debugging
        (window as any).pointerTargeter = pointer;
      }
    }

    if (config.enabled) {
      pointer.enable();
    } else {
      pointer.disable();
    }
  } catch (error) {
    logger.error('❌ Failed to initialize pointer:', error);
  }
}

// Listen for config changes and update pointer accordingly
ConfigStorageService.onChange((newConfig) => {
  if (pointer) {
    if (newConfig.enabled) {
      pointer.enable();
    } else {
      pointer.disable();
    }
  }
});

chrome.runtime.onMessage.addListener((request: any, _sender, sendResponse) => {
  if (!pointer) {
    sendResponse({ success: false, error: 'Pointer not initialized' });
    return false;
  }

  if (request?.type === 'SYNC_TAB_SELECTIONS') {
    try {
      pointer.syncSelectionsFromBackground(Array.isArray(request.data) ? request.data : []);
      sendResponse({ success: true });
    } catch (error) {
      logger.error('❌ Failed to sync selections from background:', error);
      sendResponse({ success: false, error: (error as Error).message });
    }
    return false;
  }

  return false;
});

// Initialize on script load
initializePointer();
