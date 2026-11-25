import { useState, type ReactNode } from 'react';
import { LogOut, Menu, User as UserIcon } from 'lucide-react';
import { Avatar, Badge, Breadcrumbs, Button, Chip, Dropdown, Header, Label, Separator } from '@heroui/react';
import type { User } from '../../schemas/auth.schema';
import { Sidebar, type SectionType, type InventarioSubSection } from '../organisms/Sidebar';
import { iniciales, TITULO_ROL } from '../../lib/usuario';
import { useColorDeRol } from '../../hooks/useColorDeRol';

export interface DashboardLayoutProps {
  user: User;
  activeSection: SectionType;
  onSelectSection: (section: SectionType) => void;
  activeInventarioSubSection?: InventarioSubSection;
  onSelectInventarioSubSection?: (subSection: InventarioSubSection) => void;
  onLogout: () => void;
  children: ReactNode;
}

const TITULOS: Record<SectionType, string> = {
  inicio: 'Menú del día',
  fichas: 'Mis fichas',
  cuenta: 'Mi cuenta mensual',
  consumos: 'Historial de consumos',
  sugerencias: 'Buzón de sugerencias',
  perfil: 'Mi perfil',
  ventas: 'Ventas',
  comprobantes: 'Pagos con QR',
  menu: 'Menú del día',
  almuerzosInvitados: 'Almuerzos invitados',
  almuerzosEspeciales: 'Almuerzos especiales',
  beneficiarios: 'Beneficiarios',
  deudas: 'Cartera de deudas',
  inventario: 'Inventario',
  grupos: 'Grupos y fichas',
  visitas: 'Visitas institucionales',
  solicitudes: 'Solicitudes de cuenta',
  usuarios: 'Usuarios',
  gestionFichas: 'Fichas de formación',
  cargas: 'Carga masiva de cuentas',
};

const SUBSECCIONES: Record<InventarioSubSection, string> = {
  stock: 'Control de stock',
  recetas: 'Recetas y productos',
  kardex: 'Kardex',
  mermas: 'Mermas',
  configuracion: 'Configuración',
};

/** El Encargado no tiene sección de perfil; los demás roles sí. */
const TIENE_PERFIL = (rol: User['role']) => rol !== 'encargado';

export const DashboardLayout = ({
  user,
  activeSection,
  onSelectSection,
  activeInventarioSubSection,
  onSelectInventarioSubSection,
  onLogout,
  children,
}: DashboardLayoutProps) => {
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  useColorDeRol(user.role);

  const fechaHoy = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        user={user}
        activeSection={activeSection}
        onSelectSection={onSelectSection}
        activeInventarioSubSection={activeInventarioSubSection}
        onSelectInventarioSubSection={onSelectInventarioSubSection}
        onLogout={onLogout}
        isOpenMobile={menuMovilAbierto}
        onCloseMobile={() => setMenuMovilAbierto(false)}
      />

      <div className="flex min-h-screen min-w-0 flex-col lg:ml-64">
        {/* human-web-design: allow slop.glass — el encabezado es fijo y el contenido pasa por debajo al desplazarse */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-separator bg-background/80 px-4 py-3 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="ghost"
              className="lg:hidden"
              aria-label="Abrir menú"
              onPress={() => setMenuMovilAbierto(true)}
            >
              <Menu />
            </Button>
            <div className="border-l-4 border-accent pl-3">
              <h2 className="text-lg font-semibold text-foreground">{TITULOS[activeSection] ?? 'SARA'}</h2>
              {activeSection === 'inventario' ? (
                <Breadcrumbs className="hidden text-xs sm:flex">
                  <Breadcrumbs.Item>Inventario</Breadcrumbs.Item>
                  <Breadcrumbs.Item>{SUBSECCIONES[activeInventarioSubSection ?? 'stock']}</Breadcrumbs.Item>
                </Breadcrumbs>
              ) : (
                <p className="hidden text-xs text-muted first-letter:uppercase sm:block">{fechaHoy}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Chip size="sm" variant="soft" color="accent" className="hidden md:inline-flex">
              {TITULO_ROL[user.role]}
            </Chip>
            <Dropdown>
              <Button variant="ghost" className="h-auto rounded-full p-0.5" aria-label="Menú de la cuenta">
                <Badge.Anchor>
                  <Avatar size="sm" color="accent" variant="soft">
                    <Avatar.Fallback>{iniciales(user.name)}</Avatar.Fallback>
                  </Avatar>
                  <Badge color="success" placement="bottom-right" size="sm" aria-label="Cuenta activa" />
                </Badge.Anchor>
              </Button>
              <Dropdown.Popover placement="bottom end" className="min-w-56">
                <Dropdown.Menu
                  aria-label="Menú de la cuenta"
                  onAction={(key) => {
                    if (key === 'perfil') onSelectSection('perfil');
                    if (key === 'salir') onLogout();
                  }}
                >
                  <Dropdown.Section>
                    <Header>
                      <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
                      <span className="block truncate text-xs font-normal text-muted">{user.email || TITULO_ROL[user.role]}</span>
                    </Header>
                    {TIENE_PERFIL(user.role) ? (
                      <Dropdown.Item id="perfil" textValue="Mi perfil">
                        <UserIcon className="size-4 shrink-0 text-muted" />
                        <Label>Mi perfil</Label>
                      </Dropdown.Item>
                    ) : null}
                  </Dropdown.Section>
                  <Separator />
                  <Dropdown.Section>
                    <Dropdown.Item id="salir" textValue="Cerrar sesión" variant="danger">
                      <LogOut className="size-4 shrink-0 text-danger" />
                      <Label>Cerrar sesión</Label>
                    </Dropdown.Item>
                  </Dropdown.Section>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </header>

        {/* Las cifras de cada perfil (CifrasDelPerfil) van dentro de la sección a la que pertenecen:
            arriba de todas las secciones tapaban lo principal, como el formulario para publicar el menú */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
