// Disable ESLint rule for underscore dangle usage in this file (React internals)
/* eslint-disable no-underscore-dangle */

import {
  ComponentInfo, ElementPosition, TargetedElement,
} from '@mcp-pointer/shared/types';
import logger from './logger';

export interface ReactSourceInfo {
  fileName: string;
  lineNumber?: number;
  columnNumber?: number;
}

/**
 * 从 DOM 元素上提取 React 组件的源码位置信息
 */
export function getSourceFromElement(element: HTMLElement): ReactSourceInfo | null {
  const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber$')
    || key.startsWith('__reactInternalInstance$'));

  if (!fiberKey) return null;

  const fiber = (element as any)[fiberKey];
  if (!fiber) return null;

  let componentFiber = fiber;
  while (componentFiber && typeof componentFiber.type === 'string') {
    componentFiber = componentFiber.return;
  }

  if (!componentFiber) return null;

  if (componentFiber._debugSource) {
    return {
      fileName: componentFiber._debugSource.fileName,
      lineNumber: componentFiber._debugSource.lineNumber,
      columnNumber: componentFiber._debugSource.columnNumber,
    };
  }

  if (componentFiber._debugInfo) {
    return componentFiber._debugInfo;
  }

  if (componentFiber.elementType?.__source) {
    return {
      fileName: componentFiber.elementType.__source.fileName,
      lineNumber: componentFiber.elementType.__source.lineNumber,
      columnNumber: componentFiber.elementType.__source.columnNumber,
    };
  }

  if (componentFiber._debugOwner?._debugSource) {
    return {
      fileName: componentFiber._debugOwner._debugSource.fileName,
      lineNumber: componentFiber._debugOwner._debugSource.lineNumber,
      columnNumber: componentFiber._debugOwner._debugSource.columnNumber,
    };
  }

  if (componentFiber.pendingProps?.__source) {
    return {
      fileName: componentFiber.pendingProps.__source.fileName,
      lineNumber: componentFiber.pendingProps.__source.lineNumber,
      columnNumber: componentFiber.pendingProps.__source.columnNumber,
    };
  }

  return null;
}

/**
 * 捕获元素的 React Fiber 信息
 */
export function getReactFiberInfo(element: HTMLElement): ComponentInfo | undefined {
  try {
    const sourceInfo = getSourceFromElement(element);

    const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber$')
      || key.startsWith('__reactInternalInstance$'));

    if (!fiberKey) {
      return undefined;
    }

    const fiber = (element as any)[fiberKey];
    if (!fiber) {
      return undefined;
    }

    let componentFiber = fiber;
    while (componentFiber && typeof componentFiber.type === 'string') {
      componentFiber = componentFiber.return;
    }

    if (!componentFiber || typeof componentFiber.type !== 'function') {
      return undefined;
    }

    const componentName = componentFiber.type.displayName
                       || componentFiber.type.name
                       || 'Unknown';

    let sourceFile: string | undefined;
    if (sourceInfo) {
      const fileName = sourceInfo.fileName.split('/').pop() || sourceInfo.fileName;
      sourceFile = sourceInfo.lineNumber
        ? `${fileName}:${sourceInfo.lineNumber}`
        : fileName;
    }

    const result: ComponentInfo = {
      name: componentName,
      sourceFile,
      framework: 'react',
    };

    logger.debug('🧬 Found React Fiber info:', result);
    return result;
  } catch (error) {
    logger.error('🚨 Error extracting Fiber info:', error);
    return undefined;
  }
}

/**
 * 生成元素的基础 CSS 选择器
 */
export function generateSelector(element: HTMLElement): string {
  let selector = element.tagName.toLowerCase();
  if (element.id) selector += `#${element.id}`;
  if (element.className) {
    const classNameStr = typeof element.className === 'string'
      ? element.className
      : (element.className as any).baseVal || '';
    const classes = classNameStr.split(' ').filter((c: string) => c.trim());
    if (classes.length > 0) selector += `.${classes.join('.')}`;
  }
  return selector;
}

/**
 * 计算元素在页面上的位置
 */
export function getElementPosition(element: HTMLElement): ElementPosition {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * 提取元素的类名列表
 */
export function getElementClasses(element: HTMLElement): string[] {
  if (!element.className) return [];
  const classNameStr = typeof element.className === 'string'
    ? element.className
    : (element.className as any).baseVal || '';
  return classNameStr.split(' ').filter((c: string) => c.trim());
}

/**
 * 递归收集元素及其子元素的全部类名
 */
function collectClassNames(element: Element, buffer: Set<string>): void {
  const raw = element.getAttribute?.('class') || '';
  raw.split(/\s+/).filter(Boolean).forEach((className) => buffer.add(className));

  Array.from(element.children).forEach((child) => collectClassNames(child, buffer));
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selectorMatchesClass(selector: string, className: string): boolean {
  const escaped = escapeForRegex(className);
  const pattern = new RegExp(`\\.${escaped}(?![\\w-])`);
  return pattern.test(selector);
}

function selectorMatchesAnyClass(selectorText: string, classNames: Set<string>): boolean {
  const selectors = selectorText.split(',').map((s) => s.trim()).filter(Boolean);
  return selectors.some((selector) => {
    for (const className of classNames) {
      if (selectorMatchesClass(selector, className)) {
        return true;
      }
    }
    return false;
  });
}

function getGroupingPrelude(rule: CSSRule): string | null {
  switch (rule.type) {
    case CSSRule.MEDIA_RULE:
      return `@media ${(rule as CSSMediaRule).conditionText}`;
    case CSSRule.SUPPORTS_RULE:
      return `@supports ${(rule as CSSSupportsRule).conditionText}`;
    case (CSSRule as any).DOCUMENT_RULE:
      return `@document ${(rule as any).conditionText}`;
    case (CSSRule as any).LAYER_BLOCK_RULE:
    case (CSSRule as any).LAYER_RULE: {
      const name = (rule as any).name;
      return name ? `@layer ${name}` : '@layer';
    }
    default:
      return null;
  }
}

function wrapRuleText(ruleText: string, contexts: string[]): string {
  return contexts.reduceRight((acc, context) => `${context} { ${acc} }`, ruleText);
}

/**
 * 深度遍历样式表，收集命中的 CSS 规则
 */
function traverseCssRules(
  rules: CSSRuleList | CSSRule[],
  classNames: Set<string>,
  contexts: string[],
  collected: Set<string>,
): void {
  Array.from(rules).forEach((rule) => {
    if (rule.type === CSSRule.STYLE_RULE) {
      const styleRule = rule as CSSStyleRule;
      if (selectorMatchesAnyClass(styleRule.selectorText || '', classNames)) {
        const fullText = wrapRuleText(styleRule.cssText, contexts);
        collected.add(fullText);
      }
      return;
    }

    const nestedRules = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
    if (!nestedRules) {
      return;
    }

    const prelude = getGroupingPrelude(rule);
    const nextContexts = prelude ? [...contexts, prelude] : contexts;
    traverseCssRules(nestedRules, classNames, nextContexts, collected);
  });
}

/**
 * 收集元素及其子元素关联的全部 CSS 文本
 */
function getAllCssRulesForElement(element: HTMLElement): string[] {
  const classNames = new Set<string>();
  collectClassNames(element, classNames);

  if (classNames.size === 0) {
    return [];
  }

  const cssTexts = new Set<string>();

  Array.from(document.styleSheets).forEach((stylesheet) => {
    let rules: CSSRuleList | undefined;
    try {
      rules = stylesheet.cssRules;
    } catch (error) {
      logger.debug('无法访问样式表，可能受到跨域限制:', error);
    }

    if (!rules) {
      return;
    }

    try {
      traverseCssRules(rules, classNames, [], cssTexts);
    } catch (error) {
      logger.debug('遍历样式规则时出错:', error);
    }
  });

  return Array.from(cssTexts);
}

/**
 * 将 DOM 元素转换为 TargetedElement 结构
 */
export function adaptTargetToElement(element: HTMLElement, selectionIndex: number = 1): TargetedElement {
  return {
    idx: selectionIndex,
    selector: generateSelector(element),
    tagName: element.tagName,
    id: element.id || undefined,
    classes: getElementClasses(element),
    innerText: element.innerText || element.textContent || '',
    outerHTML: element.outerHTML,
    position: getElementPosition(element),
    allCss: getAllCssRulesForElement(element),
    componentInfo: getReactFiberInfo(element),
    timestamp: Date.now(),
    url: window.location.href,
  };
}
