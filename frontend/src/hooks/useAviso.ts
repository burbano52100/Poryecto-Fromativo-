import { useCallback, useEffect, useRef, useState } from 'react';

/** Mensaje de éxito que desaparece solo a los 5 segundos (ver AvisoExito). */
export const useAviso = () => {
  const [aviso, setAviso] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const mostrarAviso = useCallback((texto: string) => {
    clearTimeout(temporizador.current);
    setAviso(texto);
    temporizador.current = setTimeout(() => setAviso(null), 5000);
  }, []);

  return { aviso, mostrarAviso };
};
