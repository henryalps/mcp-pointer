import { ConnectionStatus, TargetedElement } from '@mcp-pointer/shared/types';
import logger from './utils/logger';
import { ElementSenderService } from './services/element-sender-service';
import { ExtensionConfig } from './utils/config';
import ConfigStorageService from './services/config-storage-service';

let elementSender: ElementSenderService;
let currentConfig: ExtensionConfig | null = null;
const selectionsByTab = new Map<number, TargetedElement[]>();
let aggregatedSelections: TargetedElement[] = [];

const statusLogger = (status: ConnectionStatus, error?: string) => {
  switch (status) {
    case ConnectionStatus.CONNECTING:
      logger.info('🔄 Connecting to WebSocket...');
      break;
    case ConnectionStatus.CONNECTED:
      logger.info('✅ Connected');
      break;
    case ConnectionStatus.ERROR:
      logger.error('❌ Failed:', error);
      break;
    default:
      break;
  }
};

function cloneSelection(element: TargetedElement, tabId: number | undefined): TargetedElement {
  return {
    ...element,
    tabId: typeof tabId === 'number' ? tabId : element.tabId,
  };
}

function sortSelections(elements: TargetedElement[]): TargetedElement[] {
  return [...elements].sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    if (a.idx !== b.idx) {
      return a.idx - b.idx;
    }
    const tabA = a.tabId ?? -1;
    const tabB = b.tabId ?? -1;
    return tabA - tabB;
  });
}

async function sendSelectionsToServer(elements: TargetedElement[]): Promise<void> {
  if (!elementSender) {
    elementSender = new ElementSenderService();
  }

  if (!currentConfig) {
    logger.debug('Config not ready, skipping selection broadcast');
    return;
  }

  try {
    await elementSender.sendElements(
      elements,
      currentConfig.websocket.port,
      statusLogger,
    );
  } catch (error) {
    logger.error('Failed to send selections to server:', error);
  }
}

function broadcastSelectionsToTabs(tabIds: Set<number>): void {
  tabIds.forEach((tabId) => {
    if (tabId < 0 || Number.isNaN(tabId)) {
      return;
    }

    const selections = aggregatedSelections
      .filter((selection) => selection.tabId === tabId)
      .map((selection) => ({ ...selection }));

    chrome.tabs.sendMessage(tabId, {
      type: 'SYNC_TAB_SELECTIONS',
      data: selections,
    }, () => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        logger.debug(
          `Unable to sync selections to tab ${tabId}:`,
          runtimeError.message,
        );
      }
    });
  });
}

async function rebuildSelections(notifyTabs: Set<number>): Promise<void> {
  const flattened = Array.from(selectionsByTab.values()).flat();
  aggregatedSelections = sortSelections(flattened).map((element, index) => ({
    ...element,
    idx: index + 1,
  }));

  await sendSelectionsToServer(aggregatedSelections);

  // Always notify current tabs plus any explicit notify targets
  const currentTabIds = new Set<number>(selectionsByTab.keys());
  const tabsToNotify = new Set<number>([
    ...Array.from(notifyTabs),
    ...Array.from(currentTabIds),
  ]);
  broadcastSelectionsToTabs(tabsToNotify);
}

async function handleElementSelected(
  rawElements: TargetedElement[] | TargetedElement,
  tabId: number | undefined,
): Promise<void> {
  if (!rawElements) {
    return;
  }

  const previousTabIds = new Set<number>(selectionsByTab.keys());

  const elementsArray = Array.isArray(rawElements)
    ? rawElements
    : [rawElements];

  const normalized = elementsArray.map((element) => cloneSelection(element, tabId));

  if (normalized.length === 0) {
    if (typeof tabId === 'number') {
      selectionsByTab.delete(tabId);
    }
  } else if (typeof tabId === 'number') {
    selectionsByTab.set(tabId, normalized);
  }

  await rebuildSelections(new Set<number>([
    ...Array.from(previousTabIds),
    ...(typeof tabId === 'number' ? [tabId] : []),
  ]));
}

async function removeSelections(timestamps: number[]): Promise<void> {
  if (!Array.isArray(timestamps) || timestamps.length === 0) {
    return;
  }

  const toRemove = new Set<number>(timestamps);
  const previousTabIds = new Set<number>(selectionsByTab.keys());

  Array.from(selectionsByTab.entries()).forEach(([tabId, selections]) => {
    const filtered = selections.filter((selection) => !toRemove.has(selection.timestamp));
    if (filtered.length > 0) {
      selectionsByTab.set(tabId, filtered);
    } else {
      selectionsByTab.delete(tabId);
    }
  });

  await rebuildSelections(previousTabIds);
}

function clearTabSelections(tabId: number): void {
  if (!selectionsByTab.has(tabId)) {
    return;
  }
  selectionsByTab.delete(tabId);
  void rebuildSelections(new Set<number>([tabId]));
}

// Initialize when service worker starts
async function initialize() {
  currentConfig = await ConfigStorageService.load();

  // Create the service (no connection on startup)
  elementSender = new ElementSenderService();

  logger.info('🚀 MCP Pointer background script loaded', {
    enabled: currentConfig.enabled,
    port: currentConfig.websocket.port,
  });
}

const initializationPromise = initialize();

// Listen for config changes
ConfigStorageService.onChange((newConfig: ExtensionConfig) => {
  logger.info('⚙️ Config changed:', newConfig);

  // Simply update the config - ElementSenderService handles port changes automatically
  currentConfig = newConfig;

  if (newConfig.enabled) {
    logger.info('✅ Extension enabled');
  } else {
    logger.info('❌ Extension disabled');
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabSelections(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    clearTabSelections(tabId);
  }
});

// Listen for messages from content script and popup
chrome.runtime.onMessage
  .addListener((request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
    const { type } = request || {};

    if (type === 'ELEMENT_SELECTED' && request.data) {
      initializationPromise
        .then(() => handleElementSelected(request.data, sender.tab?.id))
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          logger.error('Failed to process selected elements:', error);
          sendResponse({ success: false, error: (error as Error).message });
        });
      return true;
    }

    if (type === 'GET_SELECTED_ELEMENTS') {
      sendResponse({ success: true, elements: aggregatedSelections });
      return false;
    }

    if (type === 'REMOVE_SELECTED_ELEMENTS') {
      const timestamps = Array.isArray(request.timestamps)
        ? request.timestamps
        : [];

      initializationPromise
        .then(() => removeSelections(timestamps))
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          logger.error('Failed to remove selected elements:', error);
          sendResponse({ success: false, error: (error as Error).message });
        });
      return true;
    }

    sendResponse({ success: false, error: 'Unknown request type' });
    return false;
  });
