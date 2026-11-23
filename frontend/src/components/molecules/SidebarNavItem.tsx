import type { ReactNode } from 'react';
import { Button, Chip } from '@heroui/react';
import { ChevronDown } from 'lucide-react';

export interface SidebarNavItemProps {
  label: string;
  icon?: ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: string | number;
  hasSubItems?: boolean;
  isExpanded?: boolean;
  isSubItem?: boolean;
}

/** Elemento del menú lateral: botón fantasma de HeroUI; la sección activa lleva el acento lleno. */
export const SidebarNavItem = ({
  label,
  icon,
  isActive,
  onClick,
  badge,
  hasSubItems = false,
  isExpanded = false,
  isSubItem = false,
}: SidebarNavItemProps) => (
  <Button
    variant="ghost"
    fullWidth
    size={isSubItem ? 'sm' : 'md'}
    onPress={onClick}
    aria-current={isActive && !hasSubItems ? 'page' : undefined}
    aria-expanded={hasSubItems ? isExpanded : undefined}
    className={`justify-start rounded-lg px-3 font-normal ${
      isActive
        ? 'bg-accent font-medium text-accent-foreground hover:bg-accent'
        : 'text-muted hover:bg-surface hover:text-foreground'
    }`}
  >
    {icon}
    <span className="flex-1 text-left">{label}</span>
    {badge !== undefined && (
      <Chip size="sm" variant={isActive ? 'secondary' : 'soft'} color="accent">
        {badge}
      </Chip>
    )}
    {hasSubItems && <ChevronDown className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
  </Button>
);
