import type { LitElement } from 'lit';

import { IS_CLIENT } from './support';
import { isFunction, isNil, isString, isUndefined } from './unit';

/**
 * Requests an animation frame and waits for it to be resolved.
 *
 * @param callback - Invoked on the next animation frame.
 */
export function raf(callback?: () => void): Promise<number> {
  return new Promise((resolve) => {
    const rafId = window.requestAnimationFrame(async () => {
      await callback?.();
      resolve(rafId);
    });
  });
}

/**
 * Walks up the DOM tree from the given node's parent element up to the root. The `onDiscover`
 * callback can return `true` to skip walking up the rest of tree.
 */
export function walkUpDOMTree(
  node: HTMLElement,
  onDiscover: (node: HTMLElement) => void | boolean,
) {
  let parent = node.parentElement;

  while (parent) {
    const skip = onDiscover(parent);
    parent = skip ? null : parent.parentElement;
  }
}

/**
 * Builds an `exportsparts` attribute value given an array of `parts` and an optional `prefix`.
 */
export function buildExportPartsAttr(
  parts: string[],
  prefix: string | ((part: string) => string),
): string {
  return parts
    .map(
      (part) =>
        `${part}: ${!isFunction(prefix) ? (prefix ? `${prefix}-` : '') : prefix(part)}${part}`,
    )
    .join(', ');
}

/**
 * Registers a custom element in the CustomElementRegistry. By "safely" we mean:
 *
 * - Called only client-side (`window` is defined).
 * - The element is only registered if it hasn't been registered before under the given `name`.
 *
 * @param name - A string representing the name you are giving the element.
 * @param constructor - A class object that defines the behavior of the element.
 */
export function safelyDefineCustomElement(
  name: string,
  constructor: CustomElementConstructor,
  isClient = IS_CLIENT,
) {
  const isElementRegistered = isClient && !isUndefined(window.customElements.get(name));
  if (!isClient || isElementRegistered) return;
  window.customElements.define(name, constructor);
}

/**
 * Sets an attribute on the given `element`. If the `attrValue` is `undefined`or `null` the
 * attribute will be removed.
 *
 * @param element - The element to set the attribute on.
 * @param attrName - The name of the attribute.
 * @param attrValue - The value of the attribute.
 */
export function setAttribute(
  element: Element,
  attrName: string,
  attrValue?: string | boolean | undefined | null,
) {
  if (isNil(attrValue) || attrValue === false) {
    element.removeAttribute(attrName);
  } else {
    const value = isString(attrValue) ? attrValue : '';
    element.setAttribute(attrName, value);
  }
}

/**
 * Sets an attribute on the given `element` if it does not have the attribute set.
 *
 * @param element - The element to set the attribute on.
 * @param attrName - The name of the attribute.
 * @param attrValue - The value of the attribute.
 */
export function setAttributeIfEmpty(element: Element, attrName: string, attrValue: string) {
  if (!element.hasAttribute(attrName)) {
    element.setAttribute(attrName, attrValue);
  }
}

/**
 * Sets a CSS property on the given `element`.
 *
 * @param element - The element to set the CSS property on.
 * @param name - The name of the CSS property.
 * @param value - The value of the CSS property.
 * @param prefix - The library CSS property prefix (default: 'vds').
 */
export function setCSSProperty(
  element: HTMLElement,
  name: string,
  value?: string | null,
  prefix = 'vds',
) {
  element.style.setProperty(`--${prefix}-${name}`, value ? value : null);
}

/**
 * Returns elements assigned to the given slot in the shadow root. Filters out all nodes
 * which are not of type `Node.ELEMENT_NODE`.
 *
 * @param el - The element containing the slot.
 * @param name - The name of the slot (optional).
 */
export function getSlottedChildren(el: HTMLElement, name?: string): Element[] {
  const selector = name ? `slot[name="${name}"]` : 'slot:not([name])';

  const slot = el.shadowRoot?.querySelector(selector) as HTMLSlotElement | null;

  const childNodes = slot?.assignedNodes({ flatten: true }) ?? [];

  return Array.prototype.filter.call(childNodes, (node) => node.nodeType == Node.ELEMENT_NODE);
}

export function getElementAttributes(elementCtor: typeof LitElement): Set<string> {
  return new Set(elementCtor.observedAttributes);
}

export function observeAttributes<T extends string>(
  element: Element,
  attributes: readonly T[],
  onChange: (attrName: T, attrValue: string | null) => void,
  { skipInitial = false } = {},
): MutationObserver {
  const callback = (attrName: T) => {
    const attrValue = element.getAttribute(attrName);
    onChange?.(attrName, attrValue);
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        callback(mutation.attributeName as T);
      }
    }
  });

  if (!skipInitial) {
    for (const attrName of attributes) {
      callback(attrName);
    }
  }

  observer.observe(element, {
    attributeFilter: Array.from(attributes),
  });

  return observer;
}

/**
 * Triggered after the page has finished loaded and during the browser's idle period.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/load_event}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback}
 */
export function requestIdleCallback(callback: () => void) {
  if (__NODE__) {
    callback();
    return;
  }

  const idle = window.requestIdleCallback ?? ((fn: () => void) => fn());

  if (document.readyState === 'complete') {
    idle(callback);
  } else {
    window.addEventListener(
      'load',
      () => {
        idle(callback);
      },
      { once: true },
    );
  }
}
