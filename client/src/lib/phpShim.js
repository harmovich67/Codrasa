// Complete minimal DOM shim for Emscripten web runtime when executing inside Web Worker
if (typeof self.document === 'undefined') {
  self.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ style: {}, appendChild: () => {}, setAttribute: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {},
    documentElement: { style: {} },
    body: { style: {}, scroll: '' },
    head: { appendChild: () => {} },
    styleSheets: [{ cssRules: [] }],
    title: '',
    hidden: false,
    visibilityState: 'visible',
    pointerLockElement: null,
    fullscreenElement: null,
  };
}
if (typeof self.window === 'undefined') {
  self.window = self;
}
