import '@testing-library/jest-dom/vitest'
import 'whatwg-fetch'

import { expect } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)

// JSDOM gaps
if (!global.ResizeObserver) {
  // minimal mock
  // @ts-ignore
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// matchMedia mock (used by some UI libs)
if (!window.matchMedia) {
  // @ts-ignore
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {}, // deprecated
    removeListener() {}, // deprecated
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false },
  })
}

// createRange stub (some editors/portals need it)
if (!document.createRange) {
  // @ts-ignore
  document.createRange = () => ({
    setStart: () => {},
    setEnd: () => {},
    commonAncestorContainer: document.body,
    createContextualFragment: (html: string) => {
      const template = document.createElement('template')
      template.innerHTML = html
      return template.content
    },
  })
}

// scrollTo noop
// @ts-ignore
global.scrollTo = () => {}
