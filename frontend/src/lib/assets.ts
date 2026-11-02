/**
 * Rutas de archivos de public/ respetando la base de Vite ('/Poryecto-Fromativo-/'),
 * para que las imágenes funcionen también en GitHub Pages.
 */
export const asset = (ruta: string): string => `${import.meta.env.BASE_URL}${ruta.replace(/^\//, '')}`;

/** Resuelve una imagen que puede venir del backend como URL absoluta o como ruta de public/. */
export const resolverImagen = (url: string | null | undefined, porDefecto = '/cafeteria-bg.jpg'): string => {
  const valor = url && url.trim() !== '' ? url : porDefecto;
  return /^(https?:|data:|blob:)/.test(valor) ? valor : asset(valor);
};
