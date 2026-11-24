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
  /** Precio para instructores (ADR 025); en menús sin él, el del aprendiz. */
  precio_instructor: number;
  cantidad_disponible: number;
  cantidad_vendida: number;
  imagen_url: string | null;
  estado: EstadoMenu;
  /** Lo que paga quien consulta: aprendiz, instructor o $0 si es beneficiario. */
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
  /** Precio para instructores (ADR 025); en menús sin él, el del aprendiz. */
  precio_instructor: number;
  cantidad_disponible: number;
  cantidad_vendida: number;
  imagen_url: string | null;
  estado: EstadoMenu;
  created_at: string;
  /** Receta cuyos ingredientes descuenta cada almuerzo vendido (ADR 020); null = no descuenta. */
  receta_id: string | null;
  receta_nombre: string | null;
}

/** GET /api/menus/recetas: recetas activas para elegir en el formulario del menú. */
export interface RecetaParaMenu {
  id: string;
  codigo: string | null;
  nombre: string;
  ingredientes: number;
}

/** GET /api/menus/sugerencia: cuántos almuerzos preparar según el mismo día de semanas anteriores. */
export interface SugerenciaPreparacion {
  fecha: string;
  dia_semana: string;
  sugerencia: number | null;
  suficiente: boolean;
  mensaje: string;
}

export interface NuevoMenu {
  nombre: string;
  fecha: string;
  descripcion?: string;
  precio_aprendiz: number;
  precio_instructor?: number | null;
  cantidad_disponible: number;
  imagen_url?: string;
  estado: EstadoMenu;
  receta_id?: string | null;
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
  /** Almuerzo del instructor cargado a su cuenta del mes (ADR 026). */
  fiado?: boolean;
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
    /** Reservas + personas de Almuerzos Invitados. */
    almuerzosServidos: number;
    almuerzosGratis: number;
    /** Reservas pagadas + Almuerzos Invitados (se pagan al registrarlos). */
    ingresosCobrados: number;
    porCobrar: number;
    almuerzosInvitados: number;
    ingresosInvitados: number;
    invitadosPorTipo: Record<TipoAlmuerzoInvitado, { personas: number; ingresos: number }>;
    /** Almuerzos especiales pagados en el período (por la fecha del pago, ADR 024). */
    almuerzosEspeciales: number;
    ingresosEspeciales: number;
  };
  breakdown: {
    fecha: string;
    label: string;
    count: number;
    ingresos: number;
    /** Personas de Almuerzos Invitados incluidas en `count`. */
    invitados: number;
    /** Personas de almuerzos especiales pagados incluidas en `count`. */
    especiales: number;
    percent: number;
  }[];
  transacciones: {
    id: string;
    fecha: string;
    /** En un almuerzo especial, la dependencia que lo pidió. */
    cliente: string;
    cedula: string;
    /** Rol del usuario; en un Almuerzo Invitado, su tipo; en un especial, 'especial'. */
    rol: string;
    /** Ficha del aprendiz; en un almuerzo especial, el número de contrato. */
    ficha: string;
    menu: string;
    precio: number;
    estado_pago: EstadoPago;
    beneficiario: boolean;
    origen: 'reserva' | 'invitado' | 'especial';
    personas: number;
  }[];
}

export interface ResumenEncargado {
  /** Reservas + personas de Almuerzos Invitados + almuerzos especiales pagados hoy. */
  ventasHoy: number;
  ingresosHoy: number;
  invitadosHoy: number;
  ingresosInvitadosHoy: number;
  /** Personas de almuerzos especiales cuyo pago se registró hoy. */
  especialesHoy?: number;
  ingresosEspecialesHoy?: number;
  porCobrarHoy: number;
  deudasPendientes: { monto: number; cantidad: number };
  sugerenciasPendientes: number;
  beneficiariosActivos: number;
  alertasPendientes?: number;
  cajaCerradaHoy?: boolean;
}

// ---------------------------------------------------------------- Almuerzos especiales (ADR 024)
export type EstadoAlmuerzoEspecial = 'programado' | 'entregado' | 'cancelado';

/** Pedido de una dependencia del SENA, con menú y precio propios, casi siempre por contrato. */
export interface AlmuerzoEspecial {
  id: string;
  solicitante: string;
  responsable: string;
  numero_contrato: string | null;
  /** YYYY-MM-DD: día de la entrega. */
  fecha: string;
  cantidad_personas: number;
  menu_descripcion: string;
  receta_id: string | null;
  receta_nombre: string | null;
  precio_unitario: number;
  total: number;
  estado: EstadoAlmuerzoEspecial;
  pagado: boolean;
  fecha_hora_entrega: string | null;
  fecha_hora_pago: string | null;
  observaciones: string | null;
  created_at: string;
  /** Solo en la respuesta de "entregado": qué pasó con la bodega. */
  avisos_inventario?: string[];
}

export interface NuevoAlmuerzoEspecial {
  solicitante: string;
  responsable: string;
  numero_contrato?: string | null;
  fecha: string;
  cantidad_personas: number;
  menu_descripcion: string;
  receta_id?: string | null;
  precio_unitario: number;
  observaciones?: string | null;
}

export interface ResumenAlmuerzosEspeciales {
  /** Entregados que el contrato aún no paga. */
  porCobrar: { cantidad: number; monto: number };
  programados: number;
  cobradoMes: number;
}

// ---------------------------------------------------------------- Almuerzos Invitados (ADR 016)
export type TipoAlmuerzoInvitado = 'instructor' | 'aprendiz' | 'corriente';

/** GET /api/almuerzos-invitados/tarifas: las tarifas viven solo en el backend. */
export interface TarifasAlmuerzosInvitados {
  tarifas: { tipo: TipoAlmuerzoInvitado; precio: number }[];
  maxPersonas: number;
}

export interface AlmuerzoInvitado {
  id: string;
  tipo: TipoAlmuerzoInvitado;
  /** Número de personas. */
  cantidad: number;
  /** Precio por persona con el que se registró (no cambia si cambia la tarifa). */
  precio_unitario: number;
  total: number;
  nombre_invitado: string | null;
  registrado_por: { id: string; nombre: string | null };
  /** ISO 8601 */
  fecha_hora: string;
  /** 'YYYY-MM-DDTHH:mm' en hora de Colombia (valor de un input datetime-local). */
  fecha_local: string;
}

export interface NuevoAlmuerzoInvitado {
  tipo: TipoAlmuerzoInvitado;
  cantidad: number;
  nombre_invitado: string | null;
}

export interface CambiosAlmuerzoInvitado {
  cantidad: number;
  nombre_invitado: string | null;
  /** 'YYYY-MM-DDTHH:mm' en hora de Colombia. */
  fecha_hora: string;
}

export interface FiltrosAlmuerzosInvitados {
  /** YYYY-MM-DD */
  desde: string;
  /** YYYY-MM-DD */
  hasta: string;
  tipo?: TipoAlmuerzoInvitado;
}

export interface TotalesAlmuerzosInvitados {
  personas: number;
  total: number;
  registros: number;
}

export interface ResumenAlmuerzosInvitados {
  hoy: string;
  desde: string;
  hasta: string;
  dia: TotalesAlmuerzosInvitados & { porTipo: Record<TipoAlmuerzoInvitado, TotalesAlmuerzosInvitados> };
  periodo: TotalesAlmuerzosInvitados & { porTipo: Record<TipoAlmuerzoInvitado, TotalesAlmuerzosInvitados> };
}

// ---------------------------------------------------------------- Coordinador (ADR 018)
export type RolGestionado = 'instructor' | 'aprendiz';
export type EstadoCuenta = 'pendiente' | 'activo' | 'inactivo' | 'rechazado';

/** GET /api/coordinador/resumen */
export interface ResumenCoordinador {
  activos: number;
  pendientes: number;
  instructores: number;
  aprendices: number;
}

/** Cuenta de instructor o aprendiz (solicitudes y lista de usuarios). */
export interface CuentaGestionada {
  id: string;
  nombre: string;
  cedula: string;
  email: string | null;
  telefono: string | null;
  rol: RolGestionado;
  estado: EstadoCuenta;
  origen: 'registro' | 'carga_masiva';
  debe_cambiar_clave: boolean;
  motivo_rechazo: string | null;
  /** ISO 8601 */
  fecha_aprobacion: string | null;
  /** ISO 8601 */
  created_at: string;
  ficha: string | null;
  programa: string | null;
}

export interface FiltrosUsuarios {
  rol?: RolGestionado;
  estado?: EstadoCuenta;
  ficha?: string;
  q?: string;
  pagina: number;
  tamano: number;
}

/** GET /api/coordinador/usuarios */
export interface PaginaUsuarios {
  total: number;
  pagina: number;
  tamano: number;
  items: CuentaGestionada[];
}

/** GET /api/coordinador/fichas */
export interface FichaCoordinador {
  id: string;
  codigo_ficha: string;
  programa: string;
  jornada: string | null;
  estado: 'activa' | 'finalizada';
  aprendices: number;
}

export type TipoCarga = 'instructores' | 'aprendices';

/** POST /api/coordinador/cargas/:tipo/previsualizar */
export interface PrevisualizacionCarga {
  tipo: TipoCarga;
  archivo: string;
  resumen: { total: number; validas: number; omitidas: number; errores: number };
  filas: {
    fila: number;
    datos: Partial<Record<'nombre' | 'cedula' | 'correo' | 'telefono' | 'ficha' | 'programa' | 'jornada', string>>;
    estado: 'valida' | 'omitida' | 'error';
    mensajes: string[];
  }[];
}

/** POST /api/coordinador/cargas/:tipo/confirmar (201) */
export interface ResultadoCarga {
  id: string;
  tipo: TipoCarga;
  archivo: string;
  /** ISO 8601 */
  fecha_hora: string;
  resumen: { total_filas: number; creados: number; omitidos: number; con_error: number };
  detalle: {
    fila: number;
    nombre: string;
    cedula: string;
    correo: string;
    ficha?: string;
    estado: 'creado' | 'omitido' | 'error';
    mensaje: string;
  }[];
}

/** GET /api/coordinador/cargas */
export interface CargaMasiva {
  id: string;
  tipo: TipoCarga;
  archivo: string;
  total_filas: number;
  creados: number;
  omitidos: number;
  con_error: number;
  /** ISO 8601 */
  fecha_hora: string;
  coordinador: string | null;
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

/** GET /api/grupos/instructores-contado: instructores que hoy pagan en la ventanilla (ADR 026). */
export interface InstructoresContadoHoy {
  instructores: AprendizConReserva[];
  caja_cerrada: boolean;
}

/** Cómo paga el instructor su almuerzo (ADR 026): fiado a su cuenta del mes o de contado en la ventanilla. */
export type FormaPago = 'fiado' | 'contado';

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
