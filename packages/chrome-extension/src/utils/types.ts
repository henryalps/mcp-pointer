import type { ComponentInfo, ElementPosition, CSSProperties } from './element';

export interface TargetedElement {
  idx: number;
  selector: string;
  tagName: string;
  id?: string;
  classes: string[];
  innerText: string;
  outerHTML: string;
  attributes: Record<string, string>;
  position: ElementPosition;
  cssProperties: CSSProperties;
  componentInfo?: ComponentInfo;
  timestamp: number;
  url: string;
}
