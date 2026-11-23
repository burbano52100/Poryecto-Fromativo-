import { useEffect } from 'react';
import type { AccountType } from '../schemas/auth.schema';

/**
 * Pinta la app con el color del rol: pone data-rol en <html> y los colores salen de
 * index.css. Va en <html> y no en el layout porque los modales, menús y avisos de HeroUI
 * se abren fuera del layout. Al desmontar (cerrar sesión) se quita y vuelve el verde de SARA.
 */
export function useColorDeRol(rol: AccountType): void {
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.rol = rol;
    return () => {
      delete raiz.dataset.rol;
    };
  }, [rol]);
}
