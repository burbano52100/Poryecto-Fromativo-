import ExcelJS from 'exceljs';
import { z } from 'zod';
import { query } from '../db/index.js';
import type { AuthenticatedUser } from '../middleware/auth.middleware.js';
import { fechaLegible, ZONA_HORARIA } from '../utils/horario.js';
import { entreDiasBogota, rangoCampos, resolverRango } from '../utils/rango.js';
import { agregarHoja, libroABuffer, type ColumnaExcel } from '../utils/excel.js';
import { formatoPesos, generarPdf, type TipoColumna } from '../utils/pdf.js';
import { filtrosUsuariosSchema, condicionesUsuarios } from '../controllers/coordinador.controller.js';
import { MOTIVOS_FIN } from './beneficios.service.js';

/**
 * Reportes exportables a PDF y Excel (ADR 025), generados en el backend con los mismos filtros
 * que la pantalla. Pesos colombianos ($10.000), fechas dd/mm/aaaa y encabezado con título, rango
 * de fechas y fecha de generación. Cada reporte solo lo descargan los roles que ven su módulo.
 */
type Rol = AuthenticatedUser['role'];

export interface Columna {
  encabezado: string;
  clave: string;
  /** Ancho en caracteres (Excel) y peso relativo en el PDF. */
  ancho: number;
  tipo?: TipoColumna;
}

export interface Hoja {
  titulo: string;
  columnas: Columna[];
  filas: Record<string, unknown>[];
  resumen?: string[];
}

export interface Reporte {
  titulo: string;
  /** Texto del rango, p. ej. "Del 01/11/2026 al 16/11/2026" (null si el reporte no usa fechas). */
  rango: string | null;
  /** Parte del nombre del archivo. */
  sufijo: string;
  hojas: Hoja[];
  horizontal?: boolean;
}

interface Definicion {
  roles: Rol[];
  generar: (params: Record<string, unknown>) => Promise<Reporte>;
}

const FECHA_HORA = (columna: string) => `TO_CHAR(${columna} AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH12:MI AM')`;
const FECHA = (columna: string) => `TO_CHAR(${columna}, 'DD/MM/YYYY')`;

const rangoTexto = (desde: string, hasta: string) => `Del ${fechaLegible(desde)} al ${fechaLegible(hasta)}`;
const rangoSchema = z.object(rangoCampos);
const sumar = (filas: Record<string, unknown>[], clave: string) => filas.reduce((s, f) => s + Number(f[clave] ?? 0), 0);

const ESTADO_PAGO: Record<string, string> = { pagado: 'Pagado', pendiente: 'Pendiente', gratis: 'Gratis (beneficiario)' };
const ESTADO_BENEFICIO: Record<string, string> = { activo: 'Activo', en_espera: 'En espera', finalizado: 'Finalizado' };
const ESTADO_CUENTA: Record<string, string> = { pendiente: 'Pendiente', activo: 'Activo', inactivo: 'Inactivo', rechazado: 'Rechazado' };
const TIPO_INVITADO: Record<string, string> = { instructor: 'Instructores', aprendiz: 'Aprendices', corriente: 'Corrientes' };

// ---------------------------------------------------------------- Definiciones

const ventas: Definicion = {
  roles: ['encargado'],
  generar: async (params) => {
    const { desde, hasta } = resolverRango(rangoSchema.parse(params), 30);
    const res = await query(
      `SELECT * FROM (
         SELECT v.fecha_hora, ${FECHA_HORA('v.fecha_hora')} AS fecha, u.nombre AS cliente, u.cedula,
                INITCAP(u.rol::text) AS tipo, COALESCE(f.codigo_ficha, '') AS ficha, m.nombre AS menu,
                1 AS personas, v.precio_cobrado::float8 AS total, v.estado_pago::text AS estado_pago, 'Reserva' AS origen
         FROM ventas v
         JOIN usuarios u ON u.id = v.usuario_id
         JOIN menus_dia m ON m.id = v.menu_id
         LEFT JOIN fichas f ON f.id = u.ficha_id
         WHERE v.estado = 'completada' AND ${entreDiasBogota('v.fecha_hora', '$1', '$2')}
         UNION ALL
         SELECT a.fecha_hora, ${FECHA_HORA('a.fecha_hora')}, COALESCE(a.nombre_invitado, ''), '',
                'Invitado ' || a.tipo::text, '', 'Almuerzo invitado', a.cantidad, a.total::float8, 'pagado', 'Almuerzos Invitados'
         FROM almuerzos_invitados a
         WHERE ${entreDiasBogota('a.fecha_hora', '$1', '$2')}
       ) t
       ORDER BY t.fecha_hora;`,
      [desde, hasta]
    );
    const filas = res.rows.map((r) => ({ ...r, estado_pago: ESTADO_PAGO[r.estado_pago] ?? r.estado_pago }));
    const cobrado = res.rows.filter((r) => r.estado_pago === 'pagado').reduce((s, r) => s + r.total, 0);
    const porCobrar = res.rows.filter((r) => r.estado_pago === 'pendiente').reduce((s, r) => s + r.total, 0);
    return {
      titulo: 'Reporte de Ventas por período',
      rango: rangoTexto(desde, hasta),
      sufijo: `${desde}_${hasta}`,
      horizontal: true,
      hojas: [
        {
          titulo: 'Ventas',
          columnas: [
            { encabezado: 'Fecha y hora', clave: 'fecha', ancho: 20 },
            { encabezado: 'Cliente', clave: 'cliente', ancho: 28 },
            { encabezado: 'Cédula', clave: 'cedula', ancho: 14 },
            { encabezado: 'Tipo', clave: 'tipo', ancho: 18 },
            { encabezado: 'Ficha', clave: 'ficha', ancho: 10 },
            { encabezado: 'Menú', clave: 'menu', ancho: 24 },
            { encabezado: 'Personas', clave: 'personas', ancho: 10, tipo: 'numero' },
            { encabezado: 'Valor', clave: 'total', ancho: 12, tipo: 'pesos' },
            { encabezado: 'Estado de pago', clave: 'estado_pago', ancho: 18 },
            { encabezado: 'Origen', clave: 'origen', ancho: 18 },
          ],
          filas,
          resumen: [
            `Almuerzos: ${sumar(res.rows, 'personas').toLocaleString('es-CO')}`,
            `Cobrado: ${formatoPesos(cobrado)} · Por cobrar: ${formatoPesos(porCobrar)}`,
          ],
        },
      ],
    };
  },
};

const deudas: Definicion = {
  roles: ['encargado'],
  generar: async (params) => {
    const { q, estado } = z
      .object({ q: z.string().trim().max(100).optional(), estado: z.enum(['ACTIVA', 'VENCIDA']).optional() })
      .parse(params);
    const res = await query(
      `SELECT * FROM (
         SELECT u.nombre, u.cedula, INITCAP(u.rol::text) AS tipo, COALESCE(u.email, '') AS correo,
                d.monto::float8 AS deuda, d.almuerzos_pendientes AS almuerzos, ${FECHA('d.fecha_origen')} AS fecha_origen,
                GREATEST(((NOW() AT TIME ZONE 'America/Bogota')::date - d.fecha_origen)::int, 0) AS dias,
                CASE WHEN ((NOW() AT TIME ZONE 'America/Bogota')::date - d.fecha_origen) > 5 THEN 'VENCIDA' ELSE 'ACTIVA' END AS estado,
                COALESCE((SELECT ${FECHA_HORA('MAX(r.fecha_hora)')} FROM recordatorios_deuda r
                          WHERE r.instructor_id = u.id AND r.estado = 'enviado'), '') AS ultimo_recordatorio
         FROM deudas d JOIN usuarios u ON u.id = d.usuario_id
         WHERE d.estado <> 'pagada' AND d.monto > 0
       ) t
       WHERE ($1::text IS NULL OR t.nombre ILIKE '%' || $1 || '%' OR t.cedula LIKE $1 || '%')
         AND ($2::text IS NULL OR t.estado = $2)
       ORDER BY t.dias DESC, t.nombre;`,
      [q || null, estado ?? null]
    );
    return {
      titulo: 'Cartera de Deudas',
      rango: `Saldos pendientes al ${fechaLegible(new Date().toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA }))}`,
      sufijo: 'actual',
      horizontal: true,
      hojas: [
        {
          titulo: 'Cartera',
          columnas: [
            { encabezado: 'Nombre', clave: 'nombre', ancho: 28 },
            { encabezado: 'Cédula', clave: 'cedula', ancho: 14 },
            { encabezado: 'Tipo', clave: 'tipo', ancho: 12 },
            { encabezado: 'Correo', clave: 'correo', ancho: 26 },
            { encabezado: 'Deuda', clave: 'deuda', ancho: 12, tipo: 'pesos' },
            { encabezado: 'Almuerzos', clave: 'almuerzos', ancho: 10, tipo: 'numero' },
            { encabezado: 'Desde', clave: 'fecha_origen', ancho: 12 },
            { encabezado: 'Días', clave: 'dias', ancho: 8, tipo: 'numero' },
            { encabezado: 'Estado', clave: 'estado', ancho: 10 },
            { encabezado: 'Último recordatorio', clave: 'ultimo_recordatorio', ancho: 20 },
          ],
          filas: res.rows,
          resumen: [`Deudores: ${res.rows.length} · Total por cobrar: ${formatoPesos(sumar(res.rows, 'deuda'))}`],
        },
      ],
    };
  },
};

const almuerzosInvitados: Definicion = {
  roles: ['encargado'],
  generar: async (params) => {
    const filtros = rangoSchema.extend({ tipo: z.enum(['instructor', 'aprendiz', 'corriente']).optional() }).parse(params);
    const { desde, hasta } = resolverRango(filtros, 0);
    const res = await query(
      `SELECT ${FECHA_HORA('a.fecha_hora')} AS fecha, a.tipo::text AS tipo, a.cantidad AS personas,
              a.precio_unitario::float8 AS precio, a.total::float8 AS total, COALESCE(a.nombre_invitado, '') AS nombre,
              COALESCE(u.nombre, '') AS registrado_por
       FROM almuerzos_invitados a LEFT JOIN usuarios u ON u.id = a.registrado_por
       WHERE ${entreDiasBogota('a.fecha_hora', '$1', '$2')} AND ($3::tipo_almuerzo_invitado IS NULL OR a.tipo = $3)
       ORDER BY a.fecha_hora;`,
      [desde, hasta, filtros.tipo ?? null]
    );
    const porTipo = Object.entries(TIPO_INVITADO).map(([tipo, etiqueta]) => {
      const filas = res.rows.filter((r) => r.tipo === tipo);
      return `${etiqueta}: ${sumar(filas, 'personas')} persona(s), ${formatoPesos(sumar(filas, 'total'))}`;
    });
    return {
      titulo: 'Almuerzos Invitados',
      rango: rangoTexto(desde, hasta),
      sufijo: `${desde}_${hasta}`,
      hojas: [
        {
          titulo: 'Registros',
          columnas: [
            { encabezado: 'Fecha y hora', clave: 'fecha', ancho: 20 },
            { encabezado: 'Tipo', clave: 'tipo_texto', ancho: 14 },
            { encabezado: 'Personas', clave: 'personas', ancho: 10, tipo: 'numero' },
            { encabezado: 'Precio unitario', clave: 'precio', ancho: 14, tipo: 'pesos' },
            { encabezado: 'Total', clave: 'total', ancho: 12, tipo: 'pesos' },
            { encabezado: 'Nombre', clave: 'nombre', ancho: 24 },
            { encabezado: 'Registrado por', clave: 'registrado_por', ancho: 24 },
          ],
          filas: res.rows.map((r) => ({ ...r, tipo_texto: TIPO_INVITADO[r.tipo] ?? r.tipo })),
          resumen: [...porTipo, `Total: ${sumar(res.rows, 'personas')} persona(s), ${formatoPesos(sumar(res.rows, 'total'))}`],
        },
      ],
    };
  },
};

const kardex: Definicion = {
  roles: ['encargado'],
  generar: async (params) => {
    const filtros = rangoSchema
      .extend({
        material_id: z.string().uuid('El material no es válido.').optional(),
        tipo: z.enum(['entrada', 'salida', 'ajuste', 'merma']).optional(),
      })
      .parse(params);
    const { desde, hasta } = resolverRango(filtros, 30);
    const [movimientos, mermas] = await Promise.all([
      query(
        `SELECT ${FECHA_HORA('k.fecha_hora')} AS fecha, m.nombre AS material, m.unidad_medida AS unidad, INITCAP(k.tipo::text) AS tipo,
                k.concepto, k.cantidad_entrada::float8 AS entrada, k.cantidad_salida::float8 AS salida,
                k.saldo_resultante::float8 AS saldo, COALESCE(u.nombre, 'Sistema') AS responsable
         FROM movimientos_kardex k
         JOIN materiales m ON m.id = k.material_id
         LEFT JOIN usuarios u ON u.id = k.usuario_id
         WHERE ${entreDiasBogota('k.fecha_hora', '$1', '$2')}
           AND ($3::uuid IS NULL OR k.material_id = $3) AND ($4::tipo_movimiento_kardex IS NULL OR k.tipo = $4)
         ORDER BY k.fecha_hora, k.created_at;`,
        [desde, hasta, filtros.material_id ?? null, filtros.tipo ?? null]
      ),
      query(
        `SELECT ${FECHA_HORA('me.fecha_hora')} AS fecha, m.nombre AS material, me.cantidad_perdida::float8 AS cantidad,
                me.unidad, me.razon, (me.cantidad_perdida * m.costo_unitario)::float8 AS costo, COALESCE(u.nombre, '') AS responsable
         FROM mermas me
         JOIN materiales m ON m.id = me.material_id
         LEFT JOIN usuarios u ON u.id = me.registrado_por
         WHERE ${entreDiasBogota('me.fecha_hora', '$1', '$2')} AND ($3::uuid IS NULL OR me.material_id = $3)
         ORDER BY me.fecha_hora;`,
        [desde, hasta, filtros.material_id ?? null]
      ),
    ]);
    return {
      titulo: 'Kardex y Mermas',
      rango: rangoTexto(desde, hasta),
      sufijo: `${desde}_${hasta}`,
      horizontal: true,
      hojas: [
        {
          titulo: 'Kardex',
          columnas: [
            { encabezado: 'Fecha y hora', clave: 'fecha', ancho: 20 },
            { encabezado: 'Material', clave: 'material', ancho: 22 },
            { encabezado: 'Unidad', clave: 'unidad', ancho: 8 },
            { encabezado: 'Tipo', clave: 'tipo', ancho: 10 },
            { encabezado: 'Concepto', clave: 'concepto', ancho: 34 },
            { encabezado: 'Entrada', clave: 'entrada', ancho: 10, tipo: 'numero' },
            { encabezado: 'Salida', clave: 'salida', ancho: 10, tipo: 'numero' },
            { encabezado: 'Saldo', clave: 'saldo', ancho: 10, tipo: 'numero' },
            { encabezado: 'Responsable', clave: 'responsable', ancho: 22 },
          ],
          filas: movimientos.rows,
          resumen: [`Movimientos: ${movimientos.rows.length}`],
        },
        {
          titulo: 'Mermas',
          columnas: [
            { encabezado: 'Fecha y hora', clave: 'fecha', ancho: 20 },
            { encabezado: 'Material', clave: 'material', ancho: 24 },
            { encabezado: 'Cantidad', clave: 'cantidad', ancho: 10, tipo: 'numero' },
            { encabezado: 'Unidad', clave: 'unidad', ancho: 8 },
            { encabezado: 'Razón', clave: 'razon', ancho: 34 },
            { encabezado: 'Costo', clave: 'costo', ancho: 12, tipo: 'pesos' },
            { encabezado: 'Responsable', clave: 'responsable', ancho: 22 },
          ],
          filas: mermas.rows,
          resumen: [`Mermas: ${mermas.rows.length} · Costo total: ${formatoPesos(sumar(mermas.rows, 'costo'))}`],
        },
      ],
    };
  },
};

const cierres: Definicion = {
  roles: ['encargado'],
  generar: async (params) => {
    const { desde, hasta } = resolverRango(rangoSchema.parse(params), 30);
    const res = await query(
      `SELECT ${FECHA('c.fecha')} AS fecha, INITCAP(c.estado::text) AS estado,
              c.almuerzos_aprendices AS aprendices, c.almuerzos_beneficiarios AS beneficiarios,
              c.almuerzos_instructores AS instructores, c.almuerzos_invitados_instructores AS inv_instructores,
              c.almuerzos_invitados_aprendices AS inv_aprendices, c.almuerzos_invitados_corrientes AS inv_corrientes,
              c.ingresos_esperados::float8 AS esperado, c.ingresos_recibidos::float8 AS recibido, c.diferencia::float8 AS diferencia,
              COALESCE(u.nombre, '') AS cerrado_por, COALESCE(c.observaciones, '') AS observaciones,
              COALESCE(c.motivo_reapertura, '') AS motivo_reapertura
       FROM cierres_caja c LEFT JOIN usuarios u ON u.id = c.cerrado_por
       WHERE c.fecha BETWEEN $1 AND $2
       ORDER BY c.fecha;`,
      [desde, hasta]
    );
    return {
      titulo: 'Cierres de Caja',
      rango: rangoTexto(desde, hasta),
      sufijo: `${desde}_${hasta}`,
      horizontal: true,
      hojas: [
        {
          titulo: 'Cierres',
          columnas: [
            { encabezado: 'Fecha', clave: 'fecha', ancho: 11 },
            { encabezado: 'Estado', clave: 'estado', ancho: 10 },
            { encabezado: 'Aprendices', clave: 'aprendices', ancho: 9, tipo: 'numero' },
            { encabezado: 'Beneficiarios', clave: 'beneficiarios', ancho: 9, tipo: 'numero' },
            { encabezado: 'Instructores', clave: 'instructores', ancho: 9, tipo: 'numero' },
            { encabezado: 'Inv. instructores', clave: 'inv_instructores', ancho: 9, tipo: 'numero' },
            { encabezado: 'Inv. aprendices', clave: 'inv_aprendices', ancho: 9, tipo: 'numero' },
            { encabezado: 'Inv. corrientes', clave: 'inv_corrientes', ancho: 9, tipo: 'numero' },
            { encabezado: 'Esperado', clave: 'esperado', ancho: 12, tipo: 'pesos' },
            { encabezado: 'Recibido', clave: 'recibido', ancho: 12, tipo: 'pesos' },
            { encabezado: 'Diferencia', clave: 'diferencia', ancho: 12, tipo: 'pesos' },
            { encabezado: 'Cerrado por', clave: 'cerrado_por', ancho: 18 },
            { encabezado: 'Observaciones', clave: 'observaciones', ancho: 26 },
          ],
          filas: res.rows,
          resumen: [
            `Esperado: ${formatoPesos(sumar(res.rows, 'esperado'))} · Recibido: ${formatoPesos(sumar(res.rows, 'recibido'))} · Diferencia: ${formatoPesos(sumar(res.rows, 'diferencia'))}`,
          ],
        },
      ],
    };
  },
};

const beneficiarios: Definicion = {
  roles: ['encargado'],
  generar: async (params) => {
    const { estado } = z
      .object({ estado: z.enum(['vigentes', 'activo', 'en_espera', 'finalizado', 'todos']).default('todos') })
      .parse(params);
    const condicion = estado === 'vigentes' ? "b.estado <> 'finalizado'" : estado === 'todos' ? 'TRUE' : 'b.estado = $1';
    const [lista, historial] = await Promise.all([
      query(
        `SELECT u.nombre, u.cedula, COALESCE(f.codigo_ficha, '') AS ficha, b.estado::text AS estado,
                ${FECHA('b.fecha_inicio')} AS fecha_inicio, COALESCE(${FECHA('b.fecha_fin')}, '') AS fecha_fin, b.prioridad,
                COALESCE(b.motivo_fin::text, '') AS motivo_fin, COALESCE(b.detalle_fin, '') AS detalle_fin,
                COALESCE(${FECHA_HORA('b.fecha_finalizacion')}, '') AS fecha_finalizacion
         FROM beneficios b JOIN usuarios u ON u.id = b.usuario_id LEFT JOIN fichas f ON f.id = u.ficha_id
         WHERE ${condicion}
         ORDER BY CASE b.estado WHEN 'activo' THEN 0 WHEN 'en_espera' THEN 1 ELSE 2 END, b.prioridad, b.created_at;`,
        condicion.includes('$1') ? [estado] : []
      ),
      query(
        `SELECT ${FECHA_HORA('a.fecha_hora')} AS fecha, a.usuario_nombre AS usuario, a.accion,
                COALESCE(u.nombre, '') AS aprendiz, COALESCE(a.datos_despues->>'estado', '') AS estado,
                COALESCE(a.datos_despues->>'motivo', '') AS motivo
         FROM auditoria a
         LEFT JOIN beneficios b ON b.id::text = a.entidad_id
         LEFT JOIN usuarios u ON u.id = b.usuario_id
         WHERE a.entidad = 'beneficio'
         ORDER BY a.fecha_hora DESC
         LIMIT 2000;`
      ),
    ]);
    const filas = lista.rows.map((r) => ({
      ...r,
      estado: ESTADO_BENEFICIO[r.estado] ?? r.estado,
      motivo_fin: r.motivo_fin ? MOTIVOS_FIN[r.motivo_fin as keyof typeof MOTIVOS_FIN] : '',
    }));
    const cuenta = (e: string) => lista.rows.filter((r) => r.estado === e).length;
    return {
      titulo: 'Beneficiarios del almuerzo',
      rango: null,
      sufijo: estado,
      horizontal: true,
      hojas: [
        {
          titulo: 'Beneficiarios',
          columnas: [
            { encabezado: 'Aprendiz', clave: 'nombre', ancho: 28 },
            { encabezado: 'Cédula', clave: 'cedula', ancho: 14 },
            { encabezado: 'Ficha', clave: 'ficha', ancho: 10 },
            { encabezado: 'Estado', clave: 'estado', ancho: 11 },
            { encabezado: 'Inicio', clave: 'fecha_inicio', ancho: 11 },
            { encabezado: 'Fin', clave: 'fecha_fin', ancho: 11 },
            { encabezado: 'Prioridad', clave: 'prioridad', ancho: 9, tipo: 'numero' },
            { encabezado: 'Motivo de fin', clave: 'motivo_fin', ancho: 24 },
            { encabezado: 'Detalle', clave: 'detalle_fin', ancho: 24 },
            { encabezado: 'Finalizado el', clave: 'fecha_finalizacion', ancho: 20 },
          ],
          filas,
          resumen: [`Activos: ${cuenta('activo')} · En espera: ${cuenta('en_espera')} · Finalizados: ${cuenta('finalizado')}`],
        },
        {
          titulo: 'Historial de cambios',
          columnas: [
            { encabezado: 'Fecha y hora', clave: 'fecha', ancho: 20 },
            { encabezado: 'Usuario', clave: 'usuario', ancho: 24 },
            { encabezado: 'Acción', clave: 'accion', ancho: 14 },
            { encabezado: 'Aprendiz', clave: 'aprendiz', ancho: 28 },
            { encabezado: 'Estado', clave: 'estado', ancho: 12 },
            { encabezado: 'Motivo', clave: 'motivo', ancho: 22 },
          ],
          filas: historial.rows,
        },
      ],
    };
  },
};

const calificaciones: Definicion = {
  roles: ['encargado'],
  generar: async (params) => {
    const filtros = rangoSchema.extend({ estrellas: z.coerce.number().int().min(1).max(5).optional() }).parse(params);
    const { desde, hasta } = resolverRango(filtros, 30);
    const [porDia, comentarios] = await Promise.all([
      query(
        `SELECT ${FECHA('m.fecha')} AS fecha, MIN(m.nombre) AS menu, ROUND(AVG(c.estrellas), 2)::float8 AS promedio,
                COUNT(*)::int AS total, COUNT(*) FILTER (WHERE c.estrellas <= 2)::int AS bajas
         FROM calificaciones_almuerzo c JOIN menus_dia m ON m.id = c.menu_id
         WHERE m.fecha BETWEEN $1 AND $2
         GROUP BY m.fecha ORDER BY m.fecha;`,
        [desde, hasta]
      ),
      // Anónimas: el reporte nunca incluye quién calificó
      query(
        `SELECT ${FECHA('m.fecha')} AS fecha, m.nombre AS menu, c.estrellas, COALESCE(c.comentario, '') AS comentario,
                CASE WHEN c.estrellas <= 2 THEN 'Sí' ELSE '' END AS baja
         FROM calificaciones_almuerzo c JOIN menus_dia m ON m.id = c.menu_id
         WHERE m.fecha BETWEEN $1 AND $2 AND ($3::int IS NULL OR c.estrellas = $3)
         ORDER BY m.fecha, c.estrellas;`,
        [desde, hasta, filtros.estrellas ?? null]
      ),
    ]);
    const total = sumar(porDia.rows, 'total');
    const promedio = total ? porDia.rows.reduce((s, r) => s + r.promedio * r.total, 0) / total : 0;
    return {
      titulo: 'Calificaciones del almuerzo',
      rango: rangoTexto(desde, hasta),
      sufijo: `${desde}_${hasta}`,
      hojas: [
        {
          titulo: 'Promedio por día',
          columnas: [
            { encabezado: 'Fecha', clave: 'fecha', ancho: 12 },
            { encabezado: 'Menú', clave: 'menu', ancho: 30 },
            { encabezado: 'Promedio', clave: 'promedio', ancho: 10, tipo: 'numero' },
            { encabezado: 'Calificaciones', clave: 'total', ancho: 12, tipo: 'numero' },
            { encabezado: 'Bajas (1-2)', clave: 'bajas', ancho: 10, tipo: 'numero' },
          ],
          filas: porDia.rows,
          resumen: [`Calificaciones: ${total} · Promedio general: ${promedio.toFixed(2).replace('.', ',')} estrellas`],
        },
        {
          titulo: 'Comentarios (anónimos)',
          columnas: [
            { encabezado: 'Fecha', clave: 'fecha', ancho: 12 },
            { encabezado: 'Menú', clave: 'menu', ancho: 26 },
            { encabezado: 'Estrellas', clave: 'estrellas', ancho: 9, tipo: 'numero' },
            { encabezado: 'Comentario', clave: 'comentario', ancho: 50 },
            { encabezado: 'Baja', clave: 'baja', ancho: 6 },
          ],
          filas: comentarios.rows,
        },
      ],
    };
  },
};

const usuarios: Definicion = {
  roles: ['coordinador'],
  generar: async (params) => {
    const filtros = filtrosUsuariosSchema.parse({ ...params, pagina: 1, tamano: 1 });
    const { where, params: valores } = condicionesUsuarios(filtros);
    const res = await query(
      `SELECT u.nombre, u.cedula, COALESCE(u.email, '') AS correo, COALESCE(u.telefono, '') AS telefono,
              INITCAP(u.rol::text) AS rol, u.estado::text AS estado, COALESCE(f.codigo_ficha, '') AS ficha,
              COALESCE(f.programa, '') AS programa, CASE u.origen WHEN 'carga_masiva' THEN 'Carga masiva' ELSE 'Registro' END AS origen,
              ${FECHA_HORA('u.created_at')} AS creado
       FROM usuarios u LEFT JOIN fichas f ON f.id = u.ficha_id
       WHERE ${where}
       ORDER BY u.rol, u.estado, f.codigo_ficha NULLS FIRST, u.nombre;`,
      valores
    );
    const cuenta = (e: string) => res.rows.filter((r) => r.estado === e).length;
    return {
      titulo: 'Usuarios: instructores y aprendices',
      rango: null,
      sufijo: [filtros.rol, filtros.estado, filtros.ficha].filter(Boolean).join('-') || 'todos',
      horizontal: true,
      hojas: [
        {
          titulo: 'Usuarios',
          columnas: [
            { encabezado: 'Nombre', clave: 'nombre', ancho: 28 },
            { encabezado: 'Cédula', clave: 'cedula', ancho: 14 },
            { encabezado: 'Correo', clave: 'correo', ancho: 28 },
            { encabezado: 'Teléfono', clave: 'telefono', ancho: 14 },
            { encabezado: 'Rol', clave: 'rol', ancho: 11 },
            { encabezado: 'Estado', clave: 'estado_texto', ancho: 11 },
            { encabezado: 'Ficha', clave: 'ficha', ancho: 10 },
            { encabezado: 'Programa', clave: 'programa', ancho: 26 },
            { encabezado: 'Origen', clave: 'origen', ancho: 13 },
            { encabezado: 'Creado', clave: 'creado', ancho: 20 },
          ],
          filas: res.rows.map((r) => ({ ...r, estado_texto: ESTADO_CUENTA[r.estado] ?? r.estado })),
          resumen: [
            `Total: ${res.rows.length} · Activos: ${cuenta('activo')} · Pendientes: ${cuenta('pendiente')} · Inactivos: ${cuenta('inactivo')} · Rechazados: ${cuenta('rechazado')}`,
          ],
        },
      ],
    };
  },
};

export const REPORTES = {
  ventas,
  deudas,
  'almuerzos-invitados': almuerzosInvitados,
  kardex,
  cierres,
  beneficiarios,
  calificaciones,
  usuarios,
} satisfies Record<string, Definicion>;

export type TipoReporte = keyof typeof REPORTES;
export const TIPOS_REPORTE = Object.keys(REPORTES) as [TipoReporte, ...TipoReporte[]];

// ---------------------------------------------------------------- Salida

const generadoEl = () =>
  `Generado el ${new Date().toLocaleString('es-CO', {
    timeZone: ZONA_HORARIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;

export async function reporteExcel(reporte: Reporte): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'SARA';
  const previas = [`SARA · ${reporte.titulo}`, ...(reporte.rango ? [reporte.rango] : []), generadoEl()];
  for (const hoja of reporte.hojas) {
    const columnas: ColumnaExcel[] = hoja.columnas.map((c) => ({
      encabezado: c.encabezado,
      clave: c.clave,
      ancho: c.ancho,
      formato: c.tipo === 'pesos' ? '"$"#,##0' : c.tipo === 'numero' ? '#,##0.###' : undefined,
    }));
    const ws = agregarHoja(libro, hoja.titulo, columnas, hoja.filas, previas);
    if (hoja.resumen?.length) {
      ws.addRow([]);
      for (const linea of hoja.resumen) ws.addRow([linea]).font = { bold: true };
    }
  }
  return libroABuffer(libro);
}

export const reportePdf = (reporte: Reporte): Promise<Buffer> =>
  generarPdf({
    titulo: reporte.titulo,
    subtitulos: [...(reporte.rango ? [reporte.rango] : []), generadoEl()],
    horizontal: reporte.horizontal,
    tablas: reporte.hojas.map((h) => ({
      titulo: reporte.hojas.length > 1 ? h.titulo : undefined,
      columnas: h.columnas,
      filas: h.filas,
      resumen: h.resumen,
    })),
  });
