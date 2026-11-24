import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Building2,
  ChefHat,
  CreditCard,
  ConciergeBell,
  HandPlatter,
  History,
  Home,
  ListFilter,
  LogOut,
  Mail,
  Package,
  Receipt,
  Settings,
  TrendingUp,
  Upload,
  User,
  UserPlus,
  Users,
  Utensils,
} from 'lucide-react';
import { Button, Drawer, Separator } from '@heroui/react';
import type { User as UserType } from '../../schemas/auth.schema';
import { SidebarNavItem } from '../molecules/SidebarNavItem';
import { SidebarUserProfile } from '../molecules/SidebarUserProfile';
import { useConsumos } from '../../hooks/useConsumos';
import { useResumenEncargado } from '../../hooks/useVentas';
import { useResumenCoordinador } from '../../hooks/useCoordinador';
import { asset } from '../../lib/assets';

export type SectionType =
  | 'inicio'
  | 'fichas'
  | 'cuenta'
  | 'consumos'
  | 'sugerencias'
  | 'perfil'
  | 'ventas'
  | 'menu'
  | 'almuerzosInvitados'
  | 'almuerzosEspeciales'
  | 'beneficiarios'
  | 'deudas'
  | 'inventario'
  | 'grupos'
  | 'visitas'
  // Coordinador
  | 'solicitudes'
  | 'usuarios'
  | 'gestionFichas'
  | 'cargas';

export type InventarioSubSection = 'stock' | 'recetas' | 'kardex' | 'mermas' | 'configuracion';

export interface SidebarProps {
  user: UserType;
  activeSection: SectionType;
  onSelectSection: (section: SectionType) => void;
  activeInventarioSubSection?: InventarioSubSection;
  onSelectInventarioSubSection?: (subSection: InventarioSubSection) => void;
  onLogout: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

interface ItemMenu {
  id: SectionType;
  label: string;
  icon: ReactNode;
  badge?: number;
}

const SUBSECCIONES_INVENTARIO: { id: InventarioSubSection; label: string; icon: ReactNode }[] = [
  { id: 'stock', label: 'Control de stock', icon: <ListFilter /> },
  { id: 'recetas', label: 'Recetas y productos', icon: <ChefHat /> },
  { id: 'kardex', label: 'Kardex', icon: <History /> },
  { id: 'mermas', label: 'Gestión de mermas', icon: <AlertTriangle /> },
  { id: 'configuracion', label: 'Configuración', icon: <Settings /> },
];

export const Sidebar = ({
  user,
  activeSection,
  onSelectSection,
  activeInventarioSubSection = 'stock',
  onSelectInventarioSubSection,
  onLogout,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) => {
  const isEncargado = user.role === 'encargado';
  const isInstructor = user.role === 'instructor';
  const isCoordinador = user.role === 'coordinador';

  // "Mis fichas" del aprendiz cuenta solo los almuerzos por pagar: es lo que pide hacer algo. El
  // total de almuerzos no va en el menú porque solo crece y no avisa nada.
  const esAprendiz = user.role === 'aprendiz';
  const { data: consumos } = useConsumos(esAprendiz);
  const porPagar = Array.isArray(consumos) ? consumos.filter((c) => c.estado_pago === 'pendiente').length || undefined : undefined;

  // Pendientes del Encargado: los mismos datos del encabezado; sin contador cuando no hay ninguno
  const { data: resumenEncargado } = useResumenEncargado(isEncargado);
  const deudasPendientes = resumenEncargado?.deudasPendientes?.cantidad || undefined;
  const sugerenciasPendientes = resumenEncargado?.sugerenciasPendientes || undefined;

  // Solicitudes de cuenta pendientes del Coordinador (ADR 018)
  const { data: resumenCoordinador } = useResumenCoordinador(isCoordinador);
  const solicitudesPendientes = resumenCoordinador?.pendientes || undefined;

  const [inventarioAbierto, setInventarioAbierto] = useState(activeSection === 'inventario');

  const seleccionar = (id: SectionType) => {
    onSelectSection(id);
    onCloseMobile?.();
  };

  const items: ItemMenu[] = isEncargado
    ? [
        { id: 'ventas', label: 'Ventas', icon: <TrendingUp /> },
        { id: 'menu', label: 'Menú del día', icon: <Utensils /> },
        { id: 'almuerzosInvitados', label: 'Almuerzos invitados', icon: <HandPlatter /> },
        { id: 'almuerzosEspeciales', label: 'Almuerzos especiales', icon: <ConciergeBell /> },
        { id: 'beneficiarios', label: 'Beneficiarios', icon: <Award /> },
        { id: 'deudas', label: 'Cartera de deudas', icon: <CreditCard />, badge: deudasPendientes },
        { id: 'inventario', label: 'Inventario', icon: <Package /> },
        { id: 'grupos', label: 'Grupos', icon: <Users /> },
        { id: 'visitas', label: 'Visitas institucionales', icon: <Building2 /> },
        { id: 'sugerencias', label: 'Buzón de sugerencias', icon: <Mail />, badge: sugerenciasPendientes },
      ]
    : isCoordinador
      ? [
          { id: 'solicitudes', label: 'Solicitudes de cuenta', icon: <UserPlus />, badge: solicitudesPendientes },
          { id: 'usuarios', label: 'Usuarios', icon: <Users /> },
          { id: 'gestionFichas', label: 'Fichas', icon: <BookOpen /> },
          { id: 'cargas', label: 'Carga masiva', icon: <Upload /> },
          { id: 'perfil', label: 'Perfil', icon: <User /> },
        ]
      : isInstructor
        ? [
            { id: 'inicio', label: 'Inicio', icon: <Home /> },
            { id: 'cuenta', label: 'Mi cuenta', icon: <CreditCard /> },
            { id: 'consumos', label: 'Consumos', icon: <Receipt /> },
            { id: 'sugerencias', label: 'Buzón de sugerencias', icon: <Mail /> },
            { id: 'perfil', label: 'Perfil', icon: <User /> },
          ]
        : [
            { id: 'inicio', label: 'Inicio', icon: <Home /> },
            { id: 'fichas', label: 'Mis fichas', icon: <Receipt />, badge: porPagar },
            { id: 'sugerencias', label: 'Buzón de sugerencias', icon: <Mail /> },
            { id: 'perfil', label: 'Perfil', icon: <User /> },
          ];

  const contenido = (
    <div className="flex h-full flex-col bg-surface-secondary">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <img src={asset('/sara-icono.svg')} alt="" className="size-8 object-contain" />
        <div className="leading-tight">
          <p className="font-semibold text-foreground">SARA</p>
          <p className="text-xs text-muted">Solicitud de almuerzos</p>
        </div>
      </div>

      <div className="px-3">
        <SidebarUserProfile user={user} />
      </div>

      <nav aria-label="Menú principal" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) =>
          item.id === 'inventario' ? (
            <div key={item.id}>
              <SidebarNavItem
                label={item.label}
                icon={item.icon}
                isActive={activeSection === 'inventario'}
                hasSubItems
                isExpanded={inventarioAbierto}
                onClick={() => {
                  setInventarioAbierto((abierto) => !abierto);
                  onSelectSection('inventario');
                }}
              />
              {inventarioAbierto && (
                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-separator pl-2">
                  {SUBSECCIONES_INVENTARIO.map((sub) => (
                    <SidebarNavItem
                      key={sub.id}
                      label={sub.label}
                      icon={sub.icon}
                      isSubItem
                      isActive={activeSection === 'inventario' && activeInventarioSubSection === sub.id}
                      onClick={() => {
                        onSelectInventarioSubSection?.(sub.id);
                        seleccionar('inventario');
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <SidebarNavItem
              key={item.id}
              label={item.label}
              icon={item.icon}
              badge={item.badge}
              isActive={activeSection === item.id}
              onClick={() => seleccionar(item.id)}
            />
          )
        )}
      </nav>

      <Separator />
      <div className="p-3">
        <Button variant="ghost" fullWidth onPress={onLogout} className="justify-start text-muted hover:text-danger">
          <LogOut />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-separator bg-surface lg:block">
        {contenido}
      </aside>

      {onCloseMobile && (
        <Drawer.Backdrop
          isOpen={isOpenMobile}
          onOpenChange={(abierto) => {
            if (!abierto) onCloseMobile();
          }}
        >
          <Drawer.Content placement="left" className="w-72 max-w-[85vw]">
            <Drawer.Dialog aria-label="Menú de navegación" className="h-full p-0">
              {contenido}
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      )}
    </>
  );
};
