/**
 * Contratos de respuesta de la API del backend (ver docs/API.md).
 * Mantener alineados con los controladores de backend/src/controllers.
 */

export type EstadoPago = 'pendiente' | 'pagado' | 'gratis';
export type EstadoMenu = 'borrador' | 'activo' | 'agotado' | 'completado';

// ---------------------------------------------------------------- Menú
export interface MenuActivo {
  id: string;
  fecha: string;
  nombre: string;
  descripcion: string | null;
  precio_aprendiz: number;
  precio_invitado: number;
  cantidad_disponible: number;
  cantidad_vendida: number;
  imagen_url: string | null;
  estado: EstadoMenu;
  precio_aplicable: number;
  es_beneficiario: boolean;
  mi_reserva: { id: string; estado_pago: EstadoPago; precio: number } | null;
  horario: { abre: string; cierra: string; abierto: boolean };
  reservable: boolean;
  motivo_no_reservable: string | null;
}

/** Menú tal como lo lista GET /api/menus (historial del Encargado). */
export interface MenuDia {
  id: string;
  fecha: string;
  nombre: string;
  descripcion: string | null;
  precio_aprendiz: number;
  precio_invitado: number;
  cantidad_disponible: number;
  cantidad_vendida: number;
  imagen_url: string | null;
  estado: EstadoMenu;
  created_at: string;
}

export interface NuevoMenu {
  nombre: string;
  fecha: string;
  descripcion?: string;
  precio_aprendiz: number;
  precio_invitado: number;
  cantidad_disponible: number;
  imagen_url?: string;
  estado: EstadoMenu;
}

// ---------------------------------------------------------------- Consumos
export interface Consumo {
  id: string;
  fecha: string;
  menu_fecha: string;
  date: string;
  title: string;
  precio: number;
  price: string;
  paymentStatus: 'PAGADO' | 'PENDIENTE' | 'GRATIS';
  estado_pago: EstadoPago;
  status: 'RESERVED' | 'CONSUMED';
}

export interface ReservaCreada extends Omit<Consumo, 'menu_fecha'> {
  message: string;
}

export interface ResumenConsumos {
  totalAlmuerzos: number;
  almuerzosMes: number;
  gastoMes: number;
  gastoTotal: number;
  pendientePago: number;
}

// ---------------------------------------------------------------- Ventas y panel del encargado
export type PeriodoVentas = 'Día' | 'Semana' | 'Mes' | 'Trimestre' | 'Semestre' | 'Año';

export interface ReporteVentas {
  period: string;
  desde: string;
  agrupacion: 'dia' | 'mes';
  totales: {
    almuerzosServidos: number;
    almuerzosGratis: number;
    ingresosCobrados: number;
    porCobrar: number;
  };
  breakdown: { fecha: string; label: string; count: number; ingresos: number; percent: number }[];
  transacciones: {
    id: string;
    fecha: string;
    cliente: string;
    cedula: string;
    rol: string;
    ficha: string;
    menu: string;
    precio: number;
    estado_pago: EstadoPago;
    beneficiario: boolean;
  }[];
}

export interface ResumenEncargado {
  ventasHoy: number;
  ingresosHoy: number;
  porCobrarHoy: number;
  deudasPendientes: { monto: number; cantidad: number };
  sugerenciasPendientes: number;
  beneficiariosActivos: number;
  solicitudesPendientes: number;
}

// ---------------------------------------------------------------- Solicitudes de cuenta (ADR 015)
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';
export type FiltroSolicitudes = EstadoSolicitud | 'todas';

export interface SolicitudCuenta {
  id: string;
  nombre: string;
  documento: string;
  email: string;
  rol: 'instructor' | 'encargado';
  estado: EstadoSolicitud;
  motivo_rechazo: string | null;
  /** ISO 8601 */
  fecha: string;
  revisado_por: string | null;
  revisado_en: string | null;
}

// ---------------------------------------------------------------- Deudas
export interface Deuda {
  id: string;
  name: string;
  type: string;
  document: string;
  debt: number;
  lunchesCount: number;
  daysOverdue: number;
  status: 'ACTIVA' | 'VENCIDA';
}

export interface MiCuenta {
  totalConsumed: number;
  pendingBalance: number;
  monthlyLunches: number;
  paymentMethod: string;
  paymentFrequency: string;
  nextCutoffDate: string;
}

export interface PagoDeudaRespuesta {
  message: string;
  saldoRestante: number;
  estado: string;
  almuerzosPagados: number;
  almuerzosPendientes: number;
}

// ---------------------------------------------------------------- Grupos
export interface Grupo {
  id: string;
  ficha: string;
  program: string;
  shift: string;
  instructor: string | null;
  studentsCount: number;
  reservasHoy: number;
  pendientesHoy: number;
  pagadosHoy: number;
  gratisHoy: number;
}

export interface AprendizConReserva {
  id: string;
  name: string;
  document: string;
  email: string | null;
  es_beneficiario: boolean;
  venta_id: string;
  precio: number;
  estado_pago: EstadoPago;
  fecha_hora: string;
}

export interface AprendicesDeGrupo {
  ficha: { id: string; codigo_ficha: string; programa: string };
  aprendices: AprendizConReserva[];
}

// ---------------------------------------------------------------- Beneficiarios
export interface Estudiante {
  id: string;
  name: string;
  document: string;
  email: string | null;
  es_beneficiario: boolean;
  ficha: string;
  activo: boolean;
  created_at: string;
}

// ---------------------------------------------------------------- Sugerencias
export interface Sugerencia {
  id: string;
  fecha: string;
  subject: string;
  message: string;
  author: string;
  role: string;
  fichaOrDoc: string;
  date: string;
  status: 'PENDIENTE' | 'ATENDIDA';
  respuesta: string | null;
}

// ---------------------------------------------------------------- Inventario
export type EstadoMaterial = 'Bueno' | 'Bajo' | 'Crítico' | 'Venciendo';

export interface Material {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  /** DD/MM/YYYY */
  expiry: string | null;
  /** YYYY-MM-DD */
  expiry_iso: string | null;
  stock: number;
  stock_minimo: number;
  costo: number;
  estado: EstadoMaterial;
}

export interface NuevoMaterial {
  name: string;
  code?: string;
  category: string;
  unit: string;
  expiry?: string;
  stock: number;
  stock_minimo: number;
  costo_unitario: number;
}

export interface Receta {
  id: string;
  code: string | null;
  name: string;
  cost: number;
  price: number;
  margen: number;
  margen_pct: number | null;
  ingredients: {
    material_id: string;
    item: string;
    cantidad: number;
    unidad: string;
    quantity: string;
    cost: number;
  }[];
}

export interface NuevaReceta {
  name: string;
  code?: string;
  price: number;
  ingredients: { material_id: string; cantidad: number }[];
}

export type TipoKardex = 'entrada' | 'salida' | 'ajuste' | 'merma';

export interface MovimientoKardex {
  id: string;
  date: string;
  fecha_iso: string;
  material_id: string;
  material: string;
  unidad: string;
  responsible: string;
  tipo: TipoKardex;
  concepto: string;
  cantidad_entrada: number | null;
  cantidad_salida: number | null;
  saldo: number;
  entry: string;
  exit: string;
}

export interface PaginaKardex {
  items: MovimientoKardex[];
  total: number;
  limit: number;
  offset: number;
}

export interface FiltrosKardex {
  desde?: string;
  hasta?: string;
  material_id?: string;
  tipo?: TipoKardex;
}

export interface Merma {
  id: string;
  date: string;
  material_id: string;
  material: string;
  cantidad: number;
  unidad: string;
  quantity: string;
  reason: string;
}

export interface NuevaMerma {
  material_id: string;
  quantity: number;
  reason: string;
}
