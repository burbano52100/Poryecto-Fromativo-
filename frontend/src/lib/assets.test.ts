import { describe, it, expect, vi, afterEach } from 'vitest';
import { asset, resolverImagen } from './assets';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('asset', () => {
  it('antepone la base de Vite para que las imágenes funcionen en GitHub Pages', () => {
    vi.stubEnv('BASE_URL', '/Poryecto-Fromativo-/');
    expect(asset('/logo.png')).toBe('/Poryecto-Fromativo-/logo.png');
    expect(asset('cafeteria-bg.jpg')).toBe('/Poryecto-Fromativo-/cafeteria-bg.jpg');
  });
});

describe('resolverImagen', () => {
  it('deja intactas las URLs absolutas y resuelve las rutas de public/', () => {
    vi.stubEnv('BASE_URL', '/Poryecto-Fromativo-/');
    expect(resolverImagen('https://cdn.ejemplo.com/plato.jpg')).toBe('https://cdn.ejemplo.com/plato.jpg');
    expect(resolverImagen('/cafeteria-bg.jpg')).toBe('/Poryecto-Fromativo-/cafeteria-bg.jpg');
    expect(resolverImagen(null)).toBe('/Poryecto-Fromativo-/cafeteria-bg.jpg');
  });
});
