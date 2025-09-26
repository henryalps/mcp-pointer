export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComponentInfo {
  name?: string;
  sourceFile?: string;
  framework?: 'react' | 'vue' | 'angular' | 'svelte';
}

export interface TargetedElement {
  idx: number;
  selector: string;
  tagName: string;
  id?: string;
  classes: string[];
  innerText: string;
  outerHTML: string;
  position: ElementPosition;
  allCss: string[];
  componentInfo?: ComponentInfo;
  timestamp: number;
  url: string;
  tabId?: number;
}

// Pointer message types between extension and MCP server
export enum PointerMessageType {
  ELEMENT_SELECTED = 'element-selected',
  ELEMENT_CLEARED = 'element-cleared',
  CONNECTION_TEST = 'connection-test',
  SERVER_STATUS = 'server-status',
}

export interface PointerMessage {
  type: PointerMessageType;
  data?: any;
  timestamp: number;
}

// Connection status for ElementSenderService
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SENDING = 'sending',
  SENT = 'sent',
  ERROR = 'error',
}
