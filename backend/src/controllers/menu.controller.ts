import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { estadoHorario, fechaBogota, MENSAJE_FUERA_DE_HORARIO } from '../utils/horario.js';
import { fechaSchema } from '../utils/rango.js';
import { sugerenciaParaFecha } from '../services/sugerencia.service.js';
import { parseId } from '../utils/validacion.js';
import { withTransaction } from '../services/inventario.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';

const menuSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  descripcion: z.string().optional(),
  precio_aprendiz: z.coerce.number().min(0, 'El precio debe ser positivo'),
  // Precio para instructores (ADR 025). Si no se envía, el instructor paga el precio del aprendiz.
  precio_instructor: z.coerce.number().min(0, 'El precio para instructores debe ser positivo').nullish(),
  cantidad_disponible: z.coerce.number().min(0, 'La cantidad debe ser positiva'),
  imagen_url: z.string().optional(),
  estado: z.enum(['borrador', 'activo', 'agotado', 'completado']).default('activo'),
  // Receta con la que se descuenta el inventario por cada almuerzo vendido (ADR 020)
  receta_id: z.string().uuid('La receta seleccionada no es válida.').nullish(),
});

/**
 * Precio que paga el instructor por un menú (ADR 025): el suyo, o el del aprendiz en los menús
 * anteriores a la migración 019 (NULL), que se cobraron así.
 */
const SQL_PRECIO_INSTRUCTOR = 'COALESCE(precio_instructor, precio_aprendiz)';

/** Columnas del menú que devuelve el historial del encargado. */
const COLUMNAS_MENU = `m.id, TO_CHAR(m.fecha, 'YYYY-MM-DD') as fecha, m.nombre, m.descripcion,
  m.precio_aprendiz::float8 as precio_aprendiz,
  COALESCE(m.precio_instructor, m.precio_aprendiz)::float8 as precio_instructor,
  m.cantidad_disponible, m.cantidad_vendida,
  m.imagen_url, m.estado, m.receta_id, r.nombre as receta_nombre, m.created_at`;

export const getActiveMenu = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // 1. Buscar menú activo priorizando el menú programado para hoy en zona horaria Bogotá
    const result = await query(
      `SELECT id, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, nombre, descripcion,
              precio_aprendiz::float8 as precio_aprendiz,
              ${SQL_PRECIO_INSTRUCTOR}::float8 as precio_instructor,
              cantidad_disponible, cantidad_vendida, imagen_url, estado
       FROM menus_dia
       WHERE estado = 'activo'
       ORDER BY (fecha = (NOW() AT TIME ZONE 'America/Bogota')::date) DESC, fecha DESC, created_at DESC
       LIMIT 1;`
    );

    let menu = result.rows[0];

    if (!menu) {
      // Fallback si no hay ningún menú activo cargado aún
      const todayBogotaRes = await query("SELECT TO_CHAR((NOW() AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD') as today;");
      const todayStr = todayBogotaRes.rows[0]?.today || new Date().toISOString().split('T')[0];
      menu = {
        id: 'default_menu',
        fecha: todayStr,
        nombre: 'Menú del Día',
        descripcion: 'Almuerzo completo: Sopa, bandeja con proteína, arroz, ensalada, jugo natural y postre.',
        precio_aprendiz: 5000,
        precio_instructor: 5000,
        cantidad_disponible: 100,
        cantidad_vendida: 0,
        imagen_url: '/cafeteria-bg.jpg',
        estado: 'activo',
      };
    }

    // 2. Precio aplicable: el aprendiz paga precio_aprendiz ($0 si es beneficiario) y el
    //    instructor, precio_instructor (ADR 025)
    let precioAplicable = Number(menu.precio_aprendiz);
    let esBeneficiario = false;

    if (req.user?.id) {
      const userRes = await query(
        'SELECT rol, es_beneficiario FROM usuarios WHERE id = $1;',
        [req.user.id]
      );
      const user = userRes.rows[0];

      if (user?.rol === 'aprendiz') {
        esBeneficiario = Boolean(user.es_beneficiario);
        precioAplicable = esBeneficiario ? 0 : Number(menu.precio_aprendiz);
      } else if (user?.rol === 'instructor') {
        precioAplicable = Number(menu.precio_instructor);
      }
    }

    // 3. Reserva del usuario para este menú y si todavía puede reservar
    const esMenuReal = menu.id !== 'default_menu';
    let miReserva: { id: string; estado_pago: string; precio: number } | null = null;

    if (req.user?.id && esMenuReal) {
      const reservaRes = await query(
        `SELECT id, estado_pago, precio_cobrado::float8 as precio
         FROM ventas
         WHERE usuario_id = $1 AND menu_id = $2 AND estado = 'completada'
         LIMIT 1;`,
        [req.user.id, menu.id]
      );
      miReserva = reservaRes.rows[0] ?? null;
    }

    const horario = estadoHorario();
    const hayCupo = Number(menu.cantidad_disponible) - Number(menu.cantidad_vendida) > 0;

    let motivoNoReservable: string | null = null;
    if (!esMenuReal) motivoNoReservable = 'El comedor aún no ha publicado el menú de hoy.';
    else if (miReserva) motivoNoReservable = 'Ya tienes tu almuerzo reservado para este menú.';
    else if (!hayCupo) motivoNoReservable = 'El cupo de almuerzos para este menú se encuentra agotado.';
    else if (!horario.abierto) motivoNoReservable = MENSAJE_FUERA_DE_HORARIO;

    return res.json({
      ...menu,
      precio_aprendiz: Number(menu.precio_aprendiz),
      precio_instructor: Number(menu.precio_instructor),
      precio_aplicable: precioAplicable,
      es_beneficiario: esBeneficiario,
      mi_reserva: miReserva,
      horario,
      reservable: motivoNoReservable === null,
      motivo_no_reservable: motivoNoReservable,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllMenus = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT ${COLUMNAS_MENU}
       FROM menus_dia m
       LEFT JOIN recetas r ON r.id = m.receta_id
       ORDER BY m.fecha DESC, m.created_at DESC;`
    );
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createMenu = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Aceptar tanto snake_case como camelCase (del formulario frontend)
    const raw = req.body;
    const body = {
      nombre: raw.nombre || raw.dishName,
      fecha: raw.fecha || raw.date,
      descripcion: raw.descripcion || raw.description,
      precio_aprendiz: raw.precio_aprendiz ?? raw.priceStudents,
      precio_instructor: raw.precio_instructor ?? raw.priceInstructors ?? null,
      cantidad_disponible: raw.cantidad_disponible ?? raw.availableQuantity,
      imagen_url: raw.imagen_url || raw.imageUrl || '/cafeteria-bg.jpg',
      estado: raw.estado || (raw.isAvailable === false ? 'borrador' : 'activo'),
      receta_id: raw.receta_id ?? raw.recetaId ?? null,
    };

    const data = menuSchema.parse(body);

    const menu = await withTransaction(async (client) => {
      if (data.receta_id) {
        const receta = await client.query('SELECT 1 FROM recetas WHERE id = $1 AND activa = true;', [data.receta_id]);
        if (receta.rowCount === 0) throw new AppError('La receta seleccionada no existe.', 404);
      }

      const anterior = await client.query('SELECT * FROM menus_dia WHERE fecha = $1 AND nombre = $2;', [
        data.fecha,
        data.nombre,
      ]);

      // Si este nuevo menú está activo, desactivamos otros menús del mismo día
      if (data.estado === 'activo') {
        await client.query(
          "UPDATE menus_dia SET estado = 'completado' WHERE fecha = $1 AND estado = 'activo' AND nombre <> $2;",
          [data.fecha, data.nombre]
        );
      }

      const insertRes = await client.query(
        `INSERT INTO menus_dia (fecha, nombre, descripcion, precio_aprendiz, cantidad_disponible, imagen_url, estado, creado_por, receta_id, precio_instructor)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (fecha, nombre) DO UPDATE SET
           descripcion = EXCLUDED.descripcion,
           precio_aprendiz = EXCLUDED.precio_aprendiz,
           precio_instructor = EXCLUDED.precio_instructor,
           cantidad_disponible = EXCLUDED.cantidad_disponible,
           imagen_url = EXCLUDED.imagen_url,
           estado = EXCLUDED.estado,
           receta_id = EXCLUDED.receta_id
         RETURNING *;`,
        [
          data.fecha,
          data.nombre,
          data.descripcion || '',
          data.precio_aprendiz,
          data.cantidad_disponible,
          data.imagen_url,
          data.estado,
          req.user?.id || null,
          data.receta_id ?? null,
          data.precio_instructor ?? null,
        ]
      );
      const creado = insertRes.rows[0];
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: anterior.rows[0] ? 'editar' : 'crear',
          entidad: 'menu_dia',
          entidadId: creado.id,
          antes: anterior.rows[0] ?? null,
          despues: creado,
        },
        client
      );
      return creado;
    });

    return res.status(201).json(menu);
  } catch (error) {
    next(error);
  }
};

export const updateMenuStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del menú no es válido.');
    const { estado } = req.body;

    if (!['borrador', 'activo', 'agotado', 'completado'].includes(estado)) {
      return res.status(400).json({ message: 'Estado de menú inválido.' });
    }

    const menu = await withTransaction(async (client) => {
      const anterior = await client.query('SELECT * FROM menus_dia WHERE id = $1 FOR UPDATE;', [id]);
      if (!anterior.rows[0]) throw new AppError('Menú no encontrado.', 404);
      const updateRes = await client.query('UPDATE menus_dia SET estado = $1 WHERE id = $2 RETURNING *;', [estado, id]);
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'cambiar_estado',
          entidad: 'menu_dia',
          entidadId: id,
          antes: { estado: anterior.rows[0].estado },
          despues: { estado },
        },
        client
      );
      return updateRes.rows[0];
    });

    return res.json(menu);
  } catch (error) {
    next(error);
  }
};

/** GET /api/menus/sugerencia?fecha= — cuántos almuerzos preparar ese día (hoy por defecto). */
export const getSugerenciaPreparacion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fecha = fechaBogota() } = z.object({ fecha: fechaSchema('La fecha').optional() }).parse(req.query);
    return res.json(await sugerenciaParaFecha(fecha));
  } catch (error) {
    next(error);
  }
};

/** GET /api/menus/recetas — recetas activas para elegir en el formulario del menú. */
export const getRecetasParaMenu = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT r.id, r.codigo, r.nombre, COUNT(ri.id)::int AS ingredientes
       FROM recetas r LEFT JOIN receta_ingredientes ri ON ri.receta_id = r.id
       WHERE r.activa = true
       GROUP BY r.id
       ORDER BY r.nombre;`
    );
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
