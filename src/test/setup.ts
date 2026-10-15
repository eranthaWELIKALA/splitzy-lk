import '@testing-library/jest-dom/vitest';

// DOM polyfills only apply to jsdom tests; node-environment tests (e.g. the SQL schema) skip them.
if (typeof window !== 'undefined') {
  // jsdom doesn't implement <dialog> modal APIs or matchMedia.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;

  // Node 25 ships an experimental global localStorage that shadows jsdom's; use an in-memory one.
  class MemoryStorage implements Storage {
    private map = new Map<string, string>();
    get length() {
      return this.map.size;
    }
    clear() {
      this.map.clear();
    }
    getItem(key: string) {
      return this.map.get(key) ?? null;
    }
    key(i: number) {
      return [...this.map.keys()][i] ?? null;
    }
    removeItem(key: string) {
      this.map.delete(key);
    }
    setItem(key: string, value: string) {
      this.map.set(key, String(value));
    }
  }
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true });
  }

  // React Router builds a native (undici) Request with jsdom's AbortSignal, which undici rejects.
  // Navigation requests are never actually sent in tests, so drop the signal.
  const NativeRequest = globalThis.Request;
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      const { signal: _signal, ...rest } = init ?? {};
      void _signal;
      super(input, rest);
    }
  } as typeof Request;
}
