import type { ReactNode } from 'react';
import { descriptionVariants, errorMessageVariants } from '@heroui/react';

interface FieldMessageProps {
  id?: string;
  children: ReactNode;
  /** `error` usa el estilo de ErrorMessage; `ayuda`, el de Description. */
  tipo?: 'error' | 'ayuda';
}

/**
 * Texto de error o de ayuda bajo un campo, con las clases de HeroUI.
 *
 * No usamos `<ErrorMessage>` ni `<Description>` de HeroUI sueltos: son `Text` de React Aria con un
 * slot, y dentro de un Modal (que solo admite el slot "description") el de error lanza
 * "Invalid slot". Aquí el vínculo con el input lo hace `aria-describedby`.
 */
export const FieldMessage = ({ id, children, tipo = 'error' }: FieldMessageProps) => (
  <p id={id} className={tipo === 'error' ? errorMessageVariants() : descriptionVariants()}>
    {children}
  </p>
);
