import { Avatar, Badge } from '@heroui/react';
import type { User } from '../../schemas/auth.schema';
import { iniciales, TITULO_ROL } from '../../lib/usuario';

export interface SidebarUserProfileProps {
  user: User;
}

export const SidebarUserProfile = ({ user }: SidebarUserProfileProps) => {
  const detalle = user.role === 'aprendiz' ? `Ficha ${user.ficha || 'sin asignar'}` : `Doc. ${user.document}`;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-secondary p-3">
      <Badge.Anchor>
        <Avatar color="accent" variant="soft">
          <Avatar.Fallback>{iniciales(user.name)}</Avatar.Fallback>
        </Avatar>
        <Badge color="success" placement="bottom-right" size="sm" aria-label="Cuenta activa" />
      </Badge.Anchor>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
        <p className="truncate text-xs text-muted">{TITULO_ROL[user.role]}</p>
        <p className="truncate text-xs text-muted">{detalle}</p>
      </div>
    </div>
  );
};
