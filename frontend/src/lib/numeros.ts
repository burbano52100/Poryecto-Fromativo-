import type { ChangeEvent } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

/** 'entero': solo dígitos (documentos, precios en pesos, porciones). 'decimal': admite un separador. */
export type ModoNumero = 'entero' | 'decimal';

/**
 * Quita todo lo que no sea número. En modo decimal deja un solo separador y convierte la
 * coma en punto, para que "2,5" se lea como 2.5.
 */
export const limpiarNumero = (valor: string, modo: ModoNumero): string => {
  if (modo === 'entero') return valor.replace(/\D/g, '');
  const [entero, ...decimales] = valor.replace(/,/g, '.').replace(/[^\d.]/g, '').split('.');
  return decimales.length > 0 ? `${entero}.${decimales.join('')}` : entero;
};

/** Limpia el valor del campo mientras se escribe o se pega, sin mover el cursor de su sitio. */
export const filtrarNumero = (e: ChangeEvent<HTMLInputElement>, modo: ModoNumero): void => {
  const campo = e.target;
  const limpio = limpiarNumero(campo.value, modo);
  if (limpio === campo.value) return;
  const cursor = limpiarNumero(campo.value.slice(0, campo.selectionStart ?? campo.value.length), modo).length;
  campo.value = limpio;
  campo.setSelectionRange(cursor, cursor);
};

/**
 * Props para un campo de React Hook Form que solo acepta números: bloquea letras y símbolos
 * y abre el teclado numérico en el celular. Uso: `<FormField {...soloNumeros(register('cantidad'))} />`.
 */
export const soloNumeros = <TNombre extends string>(
  campo: UseFormRegisterReturn<TNombre>,
  modo: ModoNumero = 'decimal'
) => ({
  ...campo,
  inputMode: modo === 'entero' ? ('numeric' as const) : ('decimal' as const),
  onChange: (e: ChangeEvent<HTMLInputElement>) => {
    filtrarNumero(e, modo);
    return campo.onChange(e);
  },
});
