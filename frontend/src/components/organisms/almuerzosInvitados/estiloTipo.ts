import { GraduationCap, Presentation, UsersRound, type LucideIcon } from 'lucide-react';
import type { TipoAlmuerzoInvitado } from '../../../types/api';

/** Ícono y color (de HeroUI) de cada tipo de almuerzo invitado. */
export const ESTILO_TIPO_INVITADO: Record<
  TipoAlmuerzoInvitado,
  { icono: LucideIcon; iconoFondo: string; color: 'accent' | 'success' | 'warning' }
> = {
  instructor: {
    icono: Presentation,
    iconoFondo: 'bg-accent-soft text-accent-soft-foreground',
    color: 'accent',
  },
  aprendiz: {
    icono: GraduationCap,
    iconoFondo: 'bg-success-soft text-success-soft-foreground',
    color: 'success',
  },
  corriente: {
    icono: UsersRound,
    iconoFondo: 'bg-warning-soft text-warning-soft-foreground',
    color: 'warning',
  },
};
