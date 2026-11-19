import { Button as HeroButton, Spinner, type ButtonProps as HeroButtonProps } from '@heroui/react';
import type { ReactNode } from 'react';

export interface ButtonProps extends Omit<HeroButtonProps, 'children'> {
  children?: ReactNode;
}

/**
 * Botón de HeroUI que, mientras `isPending` está activo, muestra un spinner
 * en lugar del icono, como recomienda la documentación de HeroUI.
 */
export const Button = ({ isPending, children, ...props }: ButtonProps) => (
  <HeroButton isPending={isPending} {...props}>
    {isPending ? <Spinner color="current" size="sm" /> : null}
    {children}
  </HeroButton>
);
