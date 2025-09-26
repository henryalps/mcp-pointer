import type { ComponentInfo, ElementPosition } from './element';

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
}
