import { useState } from 'react';
import {
  Home,
  Receipt,
  CreditCard,
  Mail,
  User,
  LogOut,
  UtensilsCrossed,
  X,
  TrendingUp,
  Utensils,
  Package,
  Users,
  ListFilter,
  ChefHat,
  History,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import type { User as UserType } from '../../schemas/auth.schema';
import { SidebarNavItem } from '../molecules/SidebarNavItem';
import { SidebarUserProfile } from '../molecules/SidebarUserProfile';

export type SectionType =
  | 'inicio'
  | 'fichas'
  | 'cuenta'
  | 'consumos'
  | 'sugerencias'
  | 'perfil'
  | 'ventas'
  | 'menu'
  | 'deudas'
  | 'inventario'
  | 'grupos';

export type InventarioSubSection =
  | 'stock'
  | 'recetas'
  | 'kardex'
  | 'mermas'
  | 'configuracion';

export interface SidebarProps {
  user: UserType;
  activeSection: SectionType;
  onSelectSection: (section: SectionType) => void;
  activeInventarioSubSection?: InventarioSubSection;
  onSelectInventarioSubSection?: (subSection: InventarioSubSection) => void;
  onLogout: () => void;
  totalLunchesCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar = ({
  user,
  activeSection,
  onSelectSection,
  activeInventarioSubSection = 'stock',
  onSelectInventarioSubSection,
  onLogout,
  totalLunchesCount = 5,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) => {
  const isEncargado = user.role === 'encargado';
  const isInstructor = user.role === 'instructor';
  const isInvitado = user.role === 'invitado';

  const [isInventarioExpanded, setIsInventarioExpanded] = useState(
    activeSection === 'inventario'
  );

  const handleInventarioClick = () => {
    const nextState = !isInventarioExpanded;
    setIsInventarioExpanded(nextState);
    onSelectSection('inventario');
  };

  const inventarioSubItems: { id: InventarioSubSection; label: string; icon: React.ReactNode }[] = [
    { id: 'stock', label: 'Control de Stock', icon: <ListFilter className="w-4 h-4" /> },
    { id: 'recetas', label: 'Recetas & Productos', icon: <ChefHat className="w-4 h-4" /> },
    { id: 'kardex', label: 'Kardex (Historial)', icon: <History className="w-4 h-4" /> },
    { id: 'mermas', label: 'Gestión de Mermas', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'configuracion', label: 'Configuración', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Overlay Backdrop for Mobile Drawer */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-gray-950/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Main Container (Light Theme) */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-white text-gray-800 flex flex-col justify-between border-r border-gray-200 shadow-md transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header & Branding */}
        <div className="p-5 flex flex-col gap-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-gray-900 flex items-center gap-1">
                  Gastro<span className="text-emerald-600">SENA</span>
                </h1>
                <p className="text-[11px] text-gray-500 font-semibold tracking-wide">
                  Comedor Estudiantil
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* User Profile Component */}
          <SidebarUserProfile user={user} />
        </div>

        {/* Navigation Items Area */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Navegación Principal
          </p>

          {isInvitado ? (
            <>
              <SidebarNavItem
                id="inicio"
                label="Inicio"
                icon={<Home className="w-5 h-5" />}
                isActive={activeSection === 'inicio'}
                roleVariant="invitado"
                onClick={() => {
                  onSelectSection('inicio');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
              <SidebarNavItem
                id="sugerencias"
                label="Buzón de Sugerencias"
                icon={<Mail className="w-5 h-5" />}
                isActive={activeSection === 'sugerencias'}
                roleVariant="invitado"
                onClick={() => {
                  onSelectSection('sugerencias');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
            </>
          ) : isEncargado ? (
            <>
              <SidebarNavItem
                id="ventas"
                label="Ventas"
                icon={<TrendingUp className="w-5 h-5" />}
                isActive={activeSection === 'ventas'}
                roleVariant="encargado"
                onClick={() => {
                  onSelectSection('ventas');
                  if (onCloseMobile) onCloseMobile();
                }}
              />

              <SidebarNavItem
                id="menu"
                label="Menú del Día"
                icon={<Utensils className="w-5 h-5" />}
                isActive={activeSection === 'menu'}
                roleVariant="encargado"
                onClick={() => {
                  onSelectSection('menu');
                  if (onCloseMobile) onCloseMobile();
                }}
              />

              <SidebarNavItem
                id="deudas"
                label="Cartera de Deudas"
                icon={<CreditCard className="w-5 h-5" />}
                isActive={activeSection === 'deudas'}
                roleVariant="encargado"
                badge="3"
                onClick={() => {
                  onSelectSection('deudas');
                  if (onCloseMobile) onCloseMobile();
                }}
              />

              {/* Inventario Accordion Parent */}
              <div>
                <SidebarNavItem
                  id="inventario"
                  label="Inventario"
                  icon={<Package className="w-5 h-5" />}
                  isActive={activeSection === 'inventario'}
                  roleVariant="encargado"
                  hasSubItems={true}
                  isExpanded={isInventarioExpanded}
                  onClick={handleInventarioClick}
                />

                {/* Sub-items accordion container */}
                {isInventarioExpanded && (
                  <div className="mt-1 space-y-1 border-l-2 border-emerald-500/40 ml-5 pl-2 animate-fade-in">
                    {inventarioSubItems.map((sub) => (
                      <SidebarNavItem
                        key={sub.id}
                        id={sub.id}
                        label={sub.label}
                        icon={sub.icon}
                        isSubItem={true}
                        roleVariant="encargado"
                        isActive={
                          activeSection === 'inventario' &&
                          activeInventarioSubSection === sub.id
                        }
                        onClick={() => {
                          onSelectSection('inventario');
                          if (onSelectInventarioSubSection) {
                            onSelectInventarioSubSection(sub.id);
                          }
                          if (onCloseMobile) onCloseMobile();
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <SidebarNavItem
                id="grupos"
                label="Grupos"
                icon={<Users className="w-5 h-5" />}
                isActive={activeSection === 'grupos'}
                roleVariant="encargado"
                onClick={() => {
                  onSelectSection('grupos');
                  if (onCloseMobile) onCloseMobile();
                }}
              />

              <SidebarNavItem
                id="sugerencias"
                label="Buzón de Sugerencias"
                icon={<Mail className="w-5 h-5" />}
                isActive={activeSection === 'sugerencias'}
                roleVariant="encargado"
                badge="2"
                onClick={() => {
                  onSelectSection('sugerencias');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
            </>
          ) : isInstructor ? (
            <>
              <SidebarNavItem
                id="inicio"
                label="Inicio"
                icon={<Home className="w-5 h-5" />}
                isActive={activeSection === 'inicio'}
                roleVariant="instructor"
                onClick={() => {
                  onSelectSection('inicio');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
              <SidebarNavItem
                id="cuenta"
                label="Mi Cuenta"
                icon={<CreditCard className="w-5 h-5" />}
                isActive={activeSection === 'cuenta'}
                roleVariant="instructor"
                onClick={() => {
                  onSelectSection('cuenta');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
              <SidebarNavItem
                id="consumos"
                label="Consumos"
                icon={<Receipt className="w-5 h-5" />}
                isActive={activeSection === 'consumos'}
                roleVariant="instructor"
                badge={totalLunchesCount}
                onClick={() => {
                  onSelectSection('consumos');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
              <SidebarNavItem
                id="sugerencias"
                label="Buzón de Sugerencias"
                icon={<Mail className="w-5 h-5" />}
                isActive={activeSection === 'sugerencias'}
                roleVariant="instructor"
                onClick={() => {
                  onSelectSection('sugerencias');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
              <SidebarNavItem
                id="perfil"
                label="Perfil"
                icon={<User className="w-5 h-5" />}
                isActive={activeSection === 'perfil'}
                roleVariant="instructor"
                onClick={() => {
                  onSelectSection('perfil');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
            </>
          ) : (
            <>
              <SidebarNavItem
                id="inicio"
                label="Inicio"
                icon={<Home className="w-5 h-5" />}
                isActive={activeSection === 'inicio'}
                roleVariant="aprendiz"
                onClick={() => {
                  onSelectSection('inicio');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
              <SidebarNavItem
                id="fichas"
                label="Mis Fichas"
                icon={<Receipt className="w-5 h-5" />}
                isActive={activeSection === 'fichas'}
                roleVariant="aprendiz"
                badge={totalLunchesCount}
                onClick={() => {
                  onSelectSection('fichas');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
              <SidebarNavItem
                id="sugerencias"
                label="Buzón de Sugerencias"
                icon={<Mail className="w-5 h-5" />}
                isActive={activeSection === 'sugerencias'}
                roleVariant="aprendiz"
                onClick={() => {
                  onSelectSection('sugerencias');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
              <SidebarNavItem
                id="perfil"
                label="Perfil"
                icon={<User className="w-5 h-5" />}
                isActive={activeSection === 'perfil'}
                roleVariant="aprendiz"
                onClick={() => {
                  onSelectSection('perfil');
                  if (onCloseMobile) onCloseMobile();
                }}
              />
            </>
          )}
        </nav>

        {/* Bottom Logout Area */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-gray-600 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition duration-200 cursor-pointer text-sm font-semibold group"
          >
            <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
};
