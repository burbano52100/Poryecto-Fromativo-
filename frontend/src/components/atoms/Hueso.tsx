import { Skeleton } from '@heroui/react';

/**
 * Pieza de un esqueleto de carga sin animación propia: el brillo lo pone el contenedor con la clase
 * `skeleton--shimmer` (patrón "Single Shimmer" de HeroUI), así todas las piezas brillan a la vez.
 */
export const Hueso = ({ className }: { className: string }) => <Skeleton animationType="none" className={className} />;
