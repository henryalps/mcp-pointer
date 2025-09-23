export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoxModel {
  margin: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  padding: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  border: string;
  borderTop: string;
  borderRight: string;
  borderBottom: string;
  borderLeft: string;
  borderRadius: string;
  borderTopLeftRadius: string;
  borderTopRightRadius: string;
  borderBottomLeftRadius: string;
  borderBottomRightRadius: string;
  boxShadow: string;
  width: string;
  height: string;
  minWidth: string;
  minHeight: string;
  maxWidth: string;
  maxHeight: string;
}

export interface Typography {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  textDecoration: string;
  textTransform: string;
  fontStyle: string;
  verticalAlign: string;
  whiteSpace: string;
  wordBreak: string;
  overflowWrap: string;
}

export interface LayoutPositioning {
  display: string;
  position: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  zIndex: string;
  float: string;
  clear: string;
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  alignContent: string;
  gap: string;
  rowGap: string;
  columnGap: string;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  gridColumn: string;
  gridRow: string;
  overflow: string;
  overflowX: string;
  overflowY: string;
  visibility: string;
  opacity: string;
}

export interface VisualEffects {
  background: string;
  backgroundColor: string;
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: string;
  backgroundAttachment: string;
  transform: string;
  transformOrigin: string;
  transition: string;
  transitionProperty: string;
  transitionDuration: string;
  transitionTimingFunction: string;
  transitionDelay: string;
  animation: string;
  animationName: string;
  animationDuration: string;
  animationTimingFunction: string;
  animationDelay: string;
  animationIterationCount: string;
  animationDirection: string;
  filter: string;
  backdropFilter: string;
  clipPath: string;
  mask: string;
}

export interface InteractiveStates {
  cursor: string;
  pointerEvents: string;
  userSelect: string;
  outline: string;
  outlineOffset: string;
  hover?: {
    backgroundColor?: string;
    color?: string;
    transform?: string;
    boxShadow?: string;
    borderColor?: string;
    opacity?: string;
  };
  focus?: {
    backgroundColor?: string;
    color?: string;
    transform?: string;
    boxShadow?: string;
    borderColor?: string;
    outline?: string;
    opacity?: string;
  };
  active?: {
    backgroundColor?: string;
    color?: string;
    transform?: string;
    boxShadow?: string;
    borderColor?: string;
    opacity?: string;
  };
  disabled?: {
    backgroundColor?: string;
    color?: string;
    cursor?: string;
    opacity?: string;
  };
}

export interface PseudoElementStyle {
  content?: string;
  display?: string;
  width?: string;
  height?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  position?: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  transform?: string;
  zIndex?: string;
}

export interface PseudoElements {
  before?: PseudoElementStyle;
  after?: PseudoElementStyle;
}

export interface ChildElementInfo {
  tagName: string;
  classes: string[];
  id?: string;
  innerText: string;
  display: string;
  position: string;
  width: string;
  height: string;
  margin: string;
  padding: string;
}

export interface CSSVariables {
  root: Record<string, string>;
  parent: Record<string, string>;
  inherited: Record<string, string>;
}

export interface DesignTokenClass {
  className: string;
  cssRules: string;
  properties: Record<string, string>;
}

export interface FontDefinition {
  fontFamily: string;
  src: string;
  fontWeight?: string;
  fontStyle?: string;
  fontDisplay?: string;
  unicodeRange?: string;
}

export interface ComponentStructure {
  framework: 'vue' | 'react' | 'angular' | 'svelte' | 'unknown';
  componentName?: string;
  scopedCSS?: string;
  parentComponents?: string[];
  template?: string;
  styleBlock?: string;
}

export interface GlobalStyles {
  cssReset: string[];
  baseStyles: Record<string, string>;
  typography: Record<string, string>;
  layout: Record<string, string>;
}

export interface CSSProperties {
  boxModel: BoxModel;
  typography: Typography;
  layout: LayoutPositioning;
  visual: VisualEffects;
  interactive: InteractiveStates;
  pseudoElements?: PseudoElements;
  customProperties?: Record<string, string>;
  childElements?: ChildElementInfo[];
  cssVariables?: CSSVariables;
  designTokens?: DesignTokenClass[];
  componentStructure?: ComponentStructure;
  fontDefinitions?: FontDefinition[];
  globalStyles?: GlobalStyles;
}

export interface ComponentInfo {
  name?: string;
  sourceFile?: string;
  framework?: 'react' | 'vue' | 'angular' | 'svelte';
}

export interface TargetedElement {
  selector: string;
  tagName: string;
  id?: string;
  classes: string[];
  innerText: string;
  attributes: Record<string, string>;
  position: ElementPosition;
  cssProperties: CSSProperties;
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
