import { useEffect, useState } from 'react';

/** Devuelve `valor` cuando deja de cambiar durante `ms` (para no consultar en cada tecla). */
export const useDebounce = <T,>(valor: T, ms = 300): T => {
  const [estable, setEstable] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setEstable(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return estable;
};
