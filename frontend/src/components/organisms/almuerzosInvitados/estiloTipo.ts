import { GraduationCap, Presentation, UsersRound, type LucideIcon } from 'lucide-react';
import type { TipoAlmuerzoInvitado } from '../../../types/api';

/** Ícono y color (de HeroUI) de cada tipo de almuerzo invitado. */
export const ESTILO_TIPO_INVITADO: Record<
  TipoAlmuerzoInvitado,
  { icono: LucideIcon; iconoColor: string; color: 'accent' | 'success' | 'warning' }
> = {
  instructor: {
    icono: Presentation,
    iconoColor: 'text-accent-soft-foreground',
    color: 'accent',
  },
  aprendiz: {
    icono: GraduationCap,
    iconoColor: 'text-success-soft-foreground',
    color: 'success',
  },
  corriente: {
    icono: UsersRound,
    iconoColor: 'text-warning-soft-foreground',
    color: 'warning',
  },
};
