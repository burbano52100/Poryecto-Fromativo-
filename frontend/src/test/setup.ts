import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toastQueue } from '@heroui/react';

// jsdom no trae ResizeObserver y el Toast de HeroUI lo usa para medir la pila de avisos
class ResizeObserverDePrueba {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverDePrueba as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  // La cola de toasts es global: que un aviso de un test no aparezca en el siguiente
  toastQueue.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});
