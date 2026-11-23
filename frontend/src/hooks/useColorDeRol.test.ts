import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useColorDeRol } from './useColorDeRol';
import type { AccountType } from '../schemas/auth.schema';

describe('useColorDeRol', () => {
  it('pone el rol en <html>, lo cambia con el rol y lo quita al desmontar', () => {
    const { rerender, unmount } = renderHook(({ rol }: { rol: AccountType }) => useColorDeRol(rol), {
      initialProps: { rol: 'instructor' },
    });
    expect(document.documentElement.dataset.rol).toBe('instructor');

    rerender({ rol: 'encargado' });
    expect(document.documentElement.dataset.rol).toBe('encargado');

    unmount();
    expect(document.documentElement.dataset.rol).toBeUndefined();
  });
});
