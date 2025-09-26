// Disable ESLint rule for underscore dangle usage in this file (React internals)
/* eslint-disable no-underscore-dangle */

import {
  ComponentInfo, CSSProperties, ElementPosition, TargetedElement,
  BoxModel, Typography, LayoutPositioning, VisualEffects,
  InteractiveStates, PseudoElements, PseudoElementStyle, ChildElementInfo,
  CSSVariables, DesignTokenClass, FontDefinition, ComponentStructure, GlobalStyles,
} from '@mcp-pointer/shared/types';
import logger from './logger';

export interface ReactSourceInfo {
  fileName: string;
  lineNumber?: number;
  columnNumber?: number;
}

/**
 * Get source file information from a DOM element's React component
 */
export function getSourceFromElement(element: HTMLElement): ReactSourceInfo | null {
  // Find React Fiber key
  const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber$')
    || key.startsWith('__reactInternalInstance$'));

  if (!fiberKey) return null;

  const fiber = (element as any)[fiberKey];
  if (!fiber) return null;

  // Walk up fiber tree to find component fiber (skip DOM fibers)
  let componentFiber = fiber;
  while (componentFiber && typeof componentFiber.type === 'string') {
    componentFiber = componentFiber.return;
  }

  if (!componentFiber) return null;

  // Try multiple source locations (React version differences)
  // React 18: _debugSource
  if (componentFiber._debugSource) {
    return {
      fileName: componentFiber._debugSource.fileName,
      lineNumber: componentFiber._debugSource.lineNumber,
      columnNumber: componentFiber._debugSource.columnNumber,
    };
  }

  // React 19: _debugInfo (often null)
  if (componentFiber._debugInfo) {
    return componentFiber._debugInfo;
  }

  // Babel plugin: __source on element type
  if (componentFiber.elementType?.__source) {
    return {
      fileName: componentFiber.elementType.__source.fileName,
      lineNumber: componentFiber.elementType.__source.lineNumber,
      columnNumber: componentFiber.elementType.__source.columnNumber,
    };
  }

  // Alternative: _owner chain
  if (componentFiber._debugOwner?._debugSource) {
    return {
      fileName: componentFiber._debugOwner._debugSource.fileName,
      lineNumber: componentFiber._debugOwner._debugSource.lineNumber,
      columnNumber: componentFiber._debugOwner._debugSource.columnNumber,
    };
  }

  // Check pendingProps for __source
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
 * Extract React Fiber information from an element
 */
export function getReactFiberInfo(element: HTMLElement): ComponentInfo | undefined {
  try {
    // Use comprehensive source detection
    const sourceInfo = getSourceFromElement(element);

    // Also get component name
    const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber$')
      || key.startsWith('__reactInternalInstance$'));

    if (fiberKey) {
      const fiber = (element as any)[fiberKey];
      if (fiber) {
        // Find component fiber
        let componentFiber = fiber;
        while (componentFiber && typeof componentFiber.type === 'string') {
          componentFiber = componentFiber.return;
        }

        if (componentFiber && componentFiber.type && typeof componentFiber.type === 'function') {
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

          const result = {
            name: componentName,
            sourceFile,
            framework: 'react' as const,
          };

          logger.debug('🧬 Found React Fiber info:', result);
          return result;
        }
      }
    }

    return undefined;
  } catch (error) {
    logger.error('🚨 Error extracting Fiber info:', error);
    return undefined;
  }
}

/**
 * Extract all attributes from an HTML element
 */
export function getElementAttributes(element: HTMLElement): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i += 1) {
    const attr = element.attributes[i];
    attributes[attr.name] = attr.value;
  }
  return attributes;
}

/**
 * Generate a CSS selector for an element
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
 * Get element position relative to the page
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

function normalizeFontFamilyName(name: string): string {
  return name.trim().replace(/^['"]|['"]$/g, '');
}

function toFontFamilyKey(name: string): string {
  return normalizeFontFamilyName(name).toLowerCase();
}

function extractFontFamilyNames(fontFamilyValue: string): string[] {
  if (!fontFamilyValue) return [];
  return fontFamilyValue
    .split(',')
    .map((font) => normalizeFontFamilyName(font))
    .filter((font) => font.length > 0);
}

function collectUsedFontFamilies(
  element: HTMLElement,
  baseComputedStyle: CSSStyleDeclaration,
): Set<string> {
  const fontFamilies = new Set<string>();

  extractFontFamilyNames(baseComputedStyle.fontFamily)
    .forEach((font) => fontFamilies.add(toFontFamilyKey(font)));

  [':before', ':after'].forEach((pseudo) => {
    try {
      const pseudoStyle = window.getComputedStyle(element, pseudo);
      extractFontFamilyNames(pseudoStyle.fontFamily)
        .forEach((font) => fontFamilies.add(toFontFamilyKey(font)));
    } catch (error) {
      logger.debug(`无法读取伪元素 ${pseudo} 的字体信息:`, error);
    }
  });

  return fontFamilies;
}

function isFontUsedByElement(usedFontFamilies: Set<string>, familyKey: string): boolean {
  if (usedFontFamilies.size === 0) {
    return true;
  }

  if (usedFontFamilies.has(familyKey)) {
    return true;
  }

  for (const used of usedFontFamilies) {
    if (familyKey.includes(used) || used.includes(familyKey)) {
      return true;
    }
  }

  return false;
}

function buildPseudoElements(
  before?: PseudoElementStyle,
  after?: PseudoElementStyle,
): PseudoElements | undefined {
  const pseudoElements: PseudoElements = {};

  if (before) {
    pseudoElements.before = before;
  }

  if (after) {
    pseudoElements.after = after;
  }

  return Object.keys(pseudoElements).length > 0 ? pseudoElements : undefined;
}

function hasCssVariableEntries(cssVariables: CSSVariables): boolean {
  return Object.values(cssVariables).some((group) => Object.keys(group).length > 0);
}

function hasGlobalStylesEntries(globalStyles: GlobalStyles): boolean {
  return globalStyles.cssReset.length > 0
    || Object.keys(globalStyles.baseStyles).length > 0
    || Object.keys(globalStyles.typography).length > 0
    || Object.keys(globalStyles.layout).length > 0;
}

function sanitizeFontDefinition(definition: Partial<FontDefinition>): FontDefinition | null {
  const fontFamily = definition.fontFamily?.trim();
  const src = definition.src?.trim();

  if (!fontFamily || !src) {
    return null;
  }

  const sanitized: Partial<FontDefinition> = {
    fontFamily,
    src,
  };

  (['fontWeight', 'fontStyle', 'fontDisplay', 'unicodeRange'] as const).forEach((key) => {
    const value = definition[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        sanitized[key] = trimmed;
      }
    }
  });

  return sanitized as FontDefinition;
}

/**
 * Extract comprehensive CSS properties from an element
 */
export function getElementCSSProperties(element: HTMLElement): CSSProperties {
  const computedStyle = window.getComputedStyle(element);
  const usedFontFamilies = collectUsedFontFamilies(element, computedStyle);

  // Box Model
  const boxModel: BoxModel = {
    margin: computedStyle.margin,
    marginTop: computedStyle.marginTop,
    marginRight: computedStyle.marginRight,
    marginBottom: computedStyle.marginBottom,
    marginLeft: computedStyle.marginLeft,
    padding: computedStyle.padding,
    paddingTop: computedStyle.paddingTop,
    paddingRight: computedStyle.paddingRight,
    paddingBottom: computedStyle.paddingBottom,
    paddingLeft: computedStyle.paddingLeft,
    border: computedStyle.border,
    borderTop: computedStyle.borderTop,
    borderRight: computedStyle.borderRight,
    borderBottom: computedStyle.borderBottom,
    borderLeft: computedStyle.borderLeft,
    borderRadius: computedStyle.borderRadius,
    borderTopLeftRadius: computedStyle.borderTopLeftRadius,
    borderTopRightRadius: computedStyle.borderTopRightRadius,
    borderBottomLeftRadius: computedStyle.borderBottomLeftRadius,
    borderBottomRightRadius: computedStyle.borderBottomRightRadius,
    boxShadow: computedStyle.boxShadow,
    width: computedStyle.width,
    height: computedStyle.height,
    minWidth: computedStyle.minWidth,
    minHeight: computedStyle.minHeight,
    maxWidth: computedStyle.maxWidth,
    maxHeight: computedStyle.maxHeight,
  };

  // Typography
  const typography: Typography = {
    fontFamily: computedStyle.fontFamily,
    fontSize: computedStyle.fontSize,
    fontWeight: computedStyle.fontWeight,
    lineHeight: computedStyle.lineHeight,
    letterSpacing: computedStyle.letterSpacing,
    textAlign: computedStyle.textAlign,
    textDecoration: computedStyle.textDecoration,
    textTransform: computedStyle.textTransform,
    fontStyle: computedStyle.fontStyle,
    verticalAlign: computedStyle.verticalAlign,
    whiteSpace: computedStyle.whiteSpace,
    wordBreak: computedStyle.wordBreak,
    overflowWrap: computedStyle.overflowWrap,
  };

  // Layout & Positioning
  const layout: LayoutPositioning = {
    display: computedStyle.display,
    position: computedStyle.position,
    top: computedStyle.top,
    right: computedStyle.right,
    bottom: computedStyle.bottom,
    left: computedStyle.left,
    zIndex: computedStyle.zIndex,
    float: computedStyle.float,
    clear: computedStyle.clear,
    flexDirection: computedStyle.flexDirection,
    flexWrap: computedStyle.flexWrap,
    justifyContent: computedStyle.justifyContent,
    alignItems: computedStyle.alignItems,
    alignContent: computedStyle.alignContent,
    gap: computedStyle.gap,
    rowGap: computedStyle.rowGap,
    columnGap: computedStyle.columnGap,
    gridTemplateColumns: computedStyle.gridTemplateColumns,
    gridTemplateRows: computedStyle.gridTemplateRows,
    gridColumn: computedStyle.gridColumn,
    gridRow: computedStyle.gridRow,
    overflow: computedStyle.overflow,
    overflowX: computedStyle.overflowX,
    overflowY: computedStyle.overflowY,
    visibility: computedStyle.visibility,
    opacity: computedStyle.opacity,
  };

  // Visual Effects
  const visual: VisualEffects = {
    background: computedStyle.background,
    backgroundColor: computedStyle.backgroundColor,
    backgroundImage: computedStyle.backgroundImage,
    backgroundSize: computedStyle.backgroundSize,
    backgroundPosition: computedStyle.backgroundPosition,
    backgroundRepeat: computedStyle.backgroundRepeat,
    backgroundAttachment: computedStyle.backgroundAttachment,
    transform: computedStyle.transform,
    transformOrigin: computedStyle.transformOrigin,
    transition: computedStyle.transition,
    transitionProperty: computedStyle.transitionProperty,
    transitionDuration: computedStyle.transitionDuration,
    transitionTimingFunction: computedStyle.transitionTimingFunction,
    transitionDelay: computedStyle.transitionDelay,
    animation: computedStyle.animation,
    animationName: computedStyle.animationName,
    animationDuration: computedStyle.animationDuration,
    animationTimingFunction: computedStyle.animationTimingFunction,
    animationDelay: computedStyle.animationDelay,
    animationIterationCount: computedStyle.animationIterationCount,
    animationDirection: computedStyle.animationDirection,
    filter: computedStyle.filter,
    backdropFilter: computedStyle.backdropFilter,
    clipPath: computedStyle.clipPath,
    mask: computedStyle.mask,
  };

  // Interactive States
  const interactive: InteractiveStates = getInteractiveStates(element);

  // Pseudo Elements
  const pseudoElements = buildPseudoElements(
    getPseudoElementStyles(element, ':before'),
    getPseudoElementStyles(element, ':after'),
  );

  // Custom Properties
  const customProperties = getCSSCustomProperties(element);

  // Child Elements
  const childElements = getChildElementInfo(element);

  // CSS Variables
  const cssVariables = getCSSVariables(element);

  // Design Token Classes
  const designTokens = getDesignTokenClasses(element);

  // Component Structure
  const componentStructure = getVueComponentStructure(element);

  // Font Definitions
  const fontDefinitions = getFontDefinitions(usedFontFamilies);

  // Global Styles
  const globalStyles = getGlobalStyles();

  return {
    boxModel,
    typography,
    layout,
    visual,
    interactive,
    ...(pseudoElements ? { pseudoElements } : {}),
    ...(Object.keys(customProperties).length > 0 ? { customProperties } : {}),
    ...(childElements.length > 0 ? { childElements } : {}),
    ...(hasCssVariableEntries(cssVariables) ? { cssVariables } : {}),
    ...(designTokens.length > 0 ? { designTokens } : {}),
    ...(componentStructure ? { componentStructure } : {}),
    ...(fontDefinitions.length > 0 ? { fontDefinitions } : {}),
    ...(hasGlobalStylesEntries(globalStyles) ? { globalStyles } : {}),
  };
}

/**
 * Get styles for pseudo-elements
 */
function getPseudoElementStyles(element: HTMLElement, pseudo: string): PseudoElementStyle | undefined {
  try {
    const pseudoStyle = window.getComputedStyle(element, pseudo);
    const style: PseudoElementStyle = {};

    const assignIfPresent = (key: keyof PseudoElementStyle, value: string) => {
      const trimmed = value.trim();
      if (trimmed) {
        style[key] = trimmed;
      }
    };

    assignIfPresent('content', pseudoStyle.content);
    assignIfPresent('display', pseudoStyle.display);
    assignIfPresent('width', pseudoStyle.width);
    assignIfPresent('height', pseudoStyle.height);
    assignIfPresent('backgroundColor', pseudoStyle.backgroundColor);
    assignIfPresent('backgroundImage', pseudoStyle.backgroundImage);
    assignIfPresent('position', pseudoStyle.position);
    assignIfPresent('top', pseudoStyle.top);
    assignIfPresent('left', pseudoStyle.left);
    assignIfPresent('right', pseudoStyle.right);
    assignIfPresent('bottom', pseudoStyle.bottom);
    assignIfPresent('transform', pseudoStyle.transform);
    assignIfPresent('zIndex', pseudoStyle.zIndex);

    return Object.keys(style).length > 0 ? style : undefined;
  } catch (error) {
    logger.debug(`Could not get styles for ${pseudo}:`, error);
    return undefined;
  }
}

/**
 * Get CSS custom properties (CSS variables)
 */
function getCSSCustomProperties(element: HTMLElement): Record<string, string> {
  const customProperties: Record<string, string> = {};
  const computedStyle = window.getComputedStyle(element);

  // Get all CSS custom properties
  for (let i = 0; i < computedStyle.length; i++) {
    const propertyName = computedStyle[i];
    if (propertyName.startsWith('--')) {
      const value = computedStyle.getPropertyValue(propertyName).trim();
      if (value) {
        customProperties[propertyName] = value;
      }
    }
  }

  return customProperties;
}

/**
 * Get information about child elements
 */
function getChildElementInfo(element: HTMLElement): ChildElementInfo[] {
  const children: ChildElementInfo[] = [];
  const childElements = Array.from(element.children) as HTMLElement[];

  childElements.forEach((child) => {
    const childStyle = window.getComputedStyle(child);
    children.push({
      tagName: child.tagName,
      classes: getElementClasses(child),
      id: child.id || undefined,
      innerText: child.innerText || child.textContent || '',
      display: childStyle.display,
      position: childStyle.position,
      width: childStyle.width,
      height: childStyle.height,
      margin: childStyle.margin,
      padding: childStyle.padding,
    });
  });

  return children;
}

/**
 * Get interactive states styles (:hover, :focus, :active, :disabled)
 */
function getInteractiveStates(element: HTMLElement): InteractiveStates {
  const baseStyle = window.getComputedStyle(element);
  const interactive: InteractiveStates = {
    cursor: baseStyle.cursor,
    pointerEvents: baseStyle.pointerEvents,
    userSelect: baseStyle.userSelect,
    outline: baseStyle.outline,
    outlineOffset: baseStyle.outlineOffset,
  };

  // Create a temporary element to test pseudo-class styles
  const tempElement = element.cloneNode(true) as HTMLElement;
  tempElement.style.position = 'absolute';
  tempElement.style.left = '-9999px';
  tempElement.style.top = '-9999px';
  tempElement.style.visibility = 'hidden';
  document.body.appendChild(tempElement);

  try {
    // Test hover state
    tempElement.classList.add('mcp-pointer-hover-test');
    const hoverStyle = window.getComputedStyle(tempElement);
    interactive.hover = {
      backgroundColor: hoverStyle.backgroundColor !== baseStyle.backgroundColor ? hoverStyle.backgroundColor : undefined,
      color: hoverStyle.color !== baseStyle.color ? hoverStyle.color : undefined,
      transform: hoverStyle.transform !== baseStyle.transform ? hoverStyle.transform : undefined,
      boxShadow: hoverStyle.boxShadow !== baseStyle.boxShadow ? hoverStyle.boxShadow : undefined,
      borderColor: hoverStyle.borderColor !== baseStyle.borderColor ? hoverStyle.borderColor : undefined,
      opacity: hoverStyle.opacity !== baseStyle.opacity ? hoverStyle.opacity : undefined,
    };

    // Test focus state
    tempElement.focus();
    const focusStyle = window.getComputedStyle(tempElement);
    interactive.focus = {
      backgroundColor: focusStyle.backgroundColor !== baseStyle.backgroundColor ? focusStyle.backgroundColor : undefined,
      color: focusStyle.color !== baseStyle.color ? focusStyle.color : undefined,
      transform: focusStyle.transform !== baseStyle.transform ? focusStyle.transform : undefined,
      boxShadow: focusStyle.boxShadow !== baseStyle.boxShadow ? focusStyle.boxShadow : undefined,
      borderColor: focusStyle.borderColor !== baseStyle.borderColor ? focusStyle.borderColor : undefined,
      outline: focusStyle.outline !== baseStyle.outline ? focusStyle.outline : undefined,
      opacity: focusStyle.opacity !== baseStyle.opacity ? focusStyle.opacity : undefined,
    };

    // Test active state
    tempElement.classList.add('mcp-pointer-active-test');
    const activeStyle = window.getComputedStyle(tempElement);
    interactive.active = {
      backgroundColor: activeStyle.backgroundColor !== baseStyle.backgroundColor ? activeStyle.backgroundColor : undefined,
      color: activeStyle.color !== baseStyle.color ? activeStyle.color : undefined,
      transform: activeStyle.transform !== baseStyle.transform ? activeStyle.transform : undefined,
      boxShadow: activeStyle.boxShadow !== baseStyle.boxShadow ? activeStyle.boxShadow : undefined,
      borderColor: activeStyle.borderColor !== baseStyle.borderColor ? activeStyle.borderColor : undefined,
      opacity: activeStyle.opacity !== baseStyle.opacity ? activeStyle.opacity : undefined,
    };

    // Test disabled state
    tempElement.setAttribute('disabled', 'disabled');
    const disabledStyle = window.getComputedStyle(tempElement);
    interactive.disabled = {
      backgroundColor: disabledStyle.backgroundColor !== baseStyle.backgroundColor ? disabledStyle.backgroundColor : undefined,
      color: disabledStyle.color !== baseStyle.color ? disabledStyle.color : undefined,
      cursor: disabledStyle.cursor !== baseStyle.cursor ? disabledStyle.cursor : undefined,
      opacity: disabledStyle.opacity !== baseStyle.opacity ? disabledStyle.opacity : undefined,
    };

  } catch (error) {
    logger.debug('Could not get interactive states:', error);
  } finally {
    // Clean up
    document.body.removeChild(tempElement);
  }

  return interactive;
}

/**
 * Get CSS variables from :root and parent selectors
 */
function getCSSVariables(element: HTMLElement): CSSVariables {
  const cssVariables: CSSVariables = {
    root: {},
    parent: {},
    inherited: {},
  };

  try {
    // Get :root variables
    const rootStyle = window.getComputedStyle(document.documentElement);
    for (let i = 0; i < rootStyle.length; i++) {
      const propertyName = rootStyle[i];
      if (propertyName.startsWith('--')) {
        const value = rootStyle.getPropertyValue(propertyName).trim();
        if (value) {
          cssVariables.root[propertyName] = value;
        }
      }
    }

    // Get parent selector variables
    let currentElement: HTMLElement | null = element.parentElement;
    while (currentElement) {
      const computedStyle = window.getComputedStyle(currentElement);
      for (let i = 0; i < computedStyle.length; i++) {
        const propertyName = computedStyle[i];
        if (propertyName.startsWith('--')) {
          const value = computedStyle.getPropertyValue(propertyName).trim();
          if (value && !(propertyName in cssVariables.parent)) {
            cssVariables.parent[propertyName] = value;
          }
        }
      }
      currentElement = currentElement.parentElement;
    }

    // Get inherited variables (variables that are actually used by the element)
    const elementStyle = window.getComputedStyle(element);
    for (let i = 0; i < elementStyle.length; i++) {
      const propertyName = elementStyle[i];
      if (propertyName.startsWith('--')) {
        const value = elementStyle.getPropertyValue(propertyName).trim();
        if (value) {
          cssVariables.inherited[propertyName] = value;
        }
      }
    }
  } catch (error) {
    logger.debug('Could not get CSS variables:', error);
  }

  return cssVariables;
}

/**
 * Get design token classes and their CSS rules
 */
function getDesignTokenClasses(element: HTMLElement): DesignTokenClass[] {
  const designTokens: DesignTokenClass[] = [];
  const classList = Array.from(element.classList);

  try {
    // Get all stylesheets
    for (let i = 0; i < document.styleSheets.length; i++) {
      const stylesheet = document.styleSheets[i];
      try {
        const rules = stylesheet.cssRules || (stylesheet as any).rules;
        if (rules) {
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (rule.type === CSSRule.STYLE_RULE) {
              const styleRule = rule as CSSStyleRule;
              const selector = styleRule.selectorText;

              // Check if this rule applies to any of our element's classes
              for (const className of classList) {
                if (selector && selector.includes(`.${className}`)) {
                  const properties: Record<string, string> = {};
                  for (let k = 0; k < styleRule.style.length; k++) {
                    const propertyName = styleRule.style[k];
                    const value = styleRule.style.getPropertyValue(propertyName).trim();
                    if (value) {
                      properties[propertyName] = value;
                    }
                  }

                  designTokens.push({
                    className,
                    cssRules: styleRule.cssText,
                    properties,
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        // Some stylesheets might not be accessible due to CORS
        logger.debug('Could not access stylesheet:', error);
      }
    }
  } catch (error) {
    logger.debug('Could not get design token classes:', error);
  }

  return designTokens;
}

/**
 * Get Vue.js component structure and scoped CSS
 */
function getVueComponentStructure(element: HTMLElement): ComponentStructure | undefined {
  const structure: ComponentStructure = {
    framework: 'unknown',
  };

  try {
    // Check if this is a Vue component
    const vueComponent = (element as any)._vnode?.component;
    if (vueComponent) {
      structure.framework = 'vue';
      structure.componentName = vueComponent.type?.name || vueComponent.type?.__name;

      // Get parent components
      const parentComponents: string[] = [];
      let currentComponent = vueComponent.parent;
      while (currentComponent) {
        parentComponents.push(currentComponent.type?.name || currentComponent.type?.__name || 'Unknown');
        currentComponent = currentComponent.parent;
      }
      if (parentComponents.length > 0) {
        structure.parentComponents = parentComponents;
      }
    }

    // Look for scoped CSS in <style scoped> tags
    const stylesheets = Array.from(document.styleSheets);
    for (const stylesheet of stylesheets) {
      try {
        const rules = stylesheet.cssRules || (stylesheet as any).rules;
        if (rules) {
          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (rule.type === CSSRule.STYLE_RULE) {
              const styleRule = rule as CSSStyleRule;
              if (styleRule.selectorText && styleRule.selectorText.includes('[data-v-')) {
                structure.scopedCSS = styleRule.cssText;
                break;
              }
            }
          }
        }
      } catch (error) {
        logger.debug('Could not access stylesheet for Vue scoped CSS:', error);
      }
    }
  } catch (error) {
    logger.debug('Could not get Vue component structure:', error);
  }

  const hasMeaningfulInfo = structure.framework !== 'unknown'
    || !!structure.componentName
    || !!structure.scopedCSS
    || !!structure.template
    || !!structure.styleBlock
    || (structure.parentComponents?.length ?? 0) > 0;

  return hasMeaningfulInfo ? structure : undefined;
}

/**
 * Get font-face declarations and font loading information
 */
function getFontDefinitions(usedFontFamilies: Set<string>): FontDefinition[] {
  const fontDefinitions: FontDefinition[] = [];

  try {
    // Get all stylesheets
    for (let i = 0; i < document.styleSheets.length; i++) {
      const stylesheet = document.styleSheets[i];
      try {
        const rules = stylesheet.cssRules || (stylesheet as any).rules;
        if (rules) {
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (rule.type === CSSRule.FONT_FACE_RULE) {
              const fontFaceRule = rule as CSSFontFaceRule;
              const fontFamilyRaw = fontFaceRule.style.getPropertyValue('font-family');
              const normalizedFamily = normalizeFontFamilyName(fontFamilyRaw);
              const familyKey = toFontFamilyKey(normalizedFamily);

              if (!normalizedFamily) {
                continue;
              }

              if (!isFontUsedByElement(usedFontFamilies, familyKey)) {
                continue;
              }

              const src = fontFaceRule.style.getPropertyValue('src').trim();
              if (!src) {
                continue;
              }

              const fontDefinition: Partial<FontDefinition> = {
                fontFamily: normalizedFamily,
                src,
              };

              const cssPropertyMap: Record<'fontWeight' | 'fontStyle' | 'fontDisplay' | 'unicodeRange', string> = {
                fontWeight: 'font-weight',
                fontStyle: 'font-style',
                fontDisplay: 'font-display',
                unicodeRange: 'unicode-range',
              };

              (['fontWeight', 'fontStyle', 'fontDisplay', 'unicodeRange'] as const).forEach((property) => {
                const value = fontFaceRule.style.getPropertyValue(cssPropertyMap[property]).trim();
                if (value) {
                  fontDefinition[property] = value;
                }
              });

              const sanitized = sanitizeFontDefinition(fontDefinition);
              if (sanitized) {
                fontDefinitions.push(sanitized);
              }
            }
          }
        }
      } catch (error) {
        logger.debug('Could not access stylesheet for font definitions:', error);
      }
    }
  } catch (error) {
    logger.debug('Could not get font definitions:', error);
  }

  return fontDefinitions;
}

/**
 * Get global styles, resets, and base styles
 */
function getGlobalStyles(): GlobalStyles {
  const globalStyles: GlobalStyles = {
    cssReset: [],
    baseStyles: {},
    typography: {},
    layout: {},
  };

  try {
    // Get all stylesheets
    for (let i = 0; i < document.styleSheets.length; i++) {
      const stylesheet = document.styleSheets[i];
      try {
        const rules = stylesheet.cssRules || (stylesheet as any).rules;
        if (rules) {
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (rule.type === CSSRule.STYLE_RULE) {
              const styleRule = rule as CSSStyleRule;
              const selector = styleRule.selectorText;

              // Check for global selectors
              if (selector === '*' || selector === 'html' || selector === 'body' ||
                  selector === 'h1, h2, h3, h4, h5, h6' || selector === 'p' ||
                  selector === 'a' || selector === 'img' || selector === 'ul, ol' ||
                  selector === 'button' || selector === 'input' || selector === 'textarea') {

                // Categorize the styles
                if (selector === '*' || selector === 'html' || selector === 'body') {
                  globalStyles.cssReset.push(styleRule.cssText);
                } else if (selector.match(/^h[1-6]/) || selector === 'p') {
                  globalStyles.typography[selector] = styleRule.cssText;
                } else if (selector === 'a' || selector === 'button' || selector === 'input' || selector === 'textarea') {
                  globalStyles.baseStyles[selector] = styleRule.cssText;
                } else {
                  globalStyles.layout[selector] = styleRule.cssText;
                }
              }
            }
          }
        }
      } catch (error) {
        logger.debug('Could not access stylesheet for global styles:', error);
      }
    }
  } catch (error) {
    logger.debug('Could not get global styles:', error);
  }

  return globalStyles;
}

/**
 * Extract CSS classes from an element as an array
 */
export function getElementClasses(element: HTMLElement): string[] {
  if (!element.className) return [];
  const classNameStr = typeof element.className === 'string'
    ? element.className
    : (element.className as any).baseVal || '';
  return classNameStr.split(' ').filter((c: string) => c.trim());
}

export function adaptTargetToElement(element: HTMLElement, selectionIndex: number = 1): TargetedElement {
  const cssProperties = getElementCSSProperties(element);

  return {
    idx: selectionIndex,
    selector: generateSelector(element),
    tagName: element.tagName,
    id: element.id || undefined,
    classes: getElementClasses(element),
    innerText: element.innerText || element.textContent || '',
    outerHTML: element.outerHTML,
    attributes: getElementAttributes(element),
    position: getElementPosition(element),
    cssProperties,
    componentInfo: getReactFiberInfo(element),
    timestamp: Date.now(),
    url: window.location.href,
  };
}
