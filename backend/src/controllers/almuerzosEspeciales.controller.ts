import { Response, NextFunction } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { MAX_PERSONAS_POR_REGISTRO } from '../config/almuerzosInvitados.js';
import { esFechaValida, fechaBogota } from '../utils/horario.js';
import { parseId } from '../utils/validacion.js';
import { withTransaction } from '../services/inventario.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';
import { avisosInventario, descontarPorReceta } from '../services/descuentoReceta.service.js';

/**
 * Almuerzos especiales (ADR 024): pedidos de dependencias del SENA (Bienestar al Aprendiz, la
 * Regional, Dirección General) con un menú distinto al del día y un precio propio, casi siempre por
 * contrato. Flujo: programado → entregado (descuenta los ingredientes de su receta) → pagado (desde
 * ese momento cuenta en Ventas). Mientras esté programado se puede cancelar.
 *
 * No entran al cierre de caja: el contrato no paga en efectivo en la ventanilla.
 */

export const MAX_TEXTO_ESPECIAL = 150;
export const MAX_DESCRIPCION_ESPECIAL = 500;
/** Tope del precio por persona: frena errores de digitación (1.500.000 en vez de 15.000). */
export const MAX_PRECIO_ESPECIAL = 500_000;
export const MENSAJE_ENTREGA_FUTURA = 'Solo puedes marcarlo entregado el día del pedido o después';

const COLUMNAS = `e.id, e.solicitante, e.responsable, e.numero_contrato,
  TO_CHAR(e.fecha, 'YYYY-MM-DD') AS fecha, e.cantidad_personas, e.menu_descripcion,
  e.receta_id, r.nombre AS receta_nombre,
  e.precio_unitario::float8 AS precio_unitario, e.total::float8 AS total,
  e.estado, e.pagado, e.fecha_hora_entrega, e.fecha_hora_pago, e.observaciones, e.created_at`;

const SELECT_ESPECIAL = `SELECT ${COLUMNAS}
  FROM almuerzos_especiales e
  LEFT JOIN recetas r ON r.id = e.receta_id`;

const buscar = async (id: string, db: Pick<pg.PoolClient, 'query'>) =>
  (await db.query(`${SELECT_ESPECIAL} WHERE e.id = $1;`, [id])).rows[0];

/** Texto obligatorio: sin espacios sobrantes, no vacío y con largo máximo. */
const texto = (campo: string, max = MAX_TEXTO_ESPECIAL) =>
  z
    .string({ error: `${campo} es obligatorio.` })
    .trim()
    .min(1, `${campo} es obligatorio.`)
    .max(max, `${campo} no puede superar ${max} caracteres.`);

/** Texto opcional: vacío o solo espacios se guarda como null. */
const textoOpcional = (campo: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${campo} no puede superar ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

const especialSchema = z.object({
  solicitante: texto('La dependencia que lo pide'),
  responsable: texto('El nombre del responsable'),
  numero_contrato: textoOpcional('El número de contrato', 60),
  fecha: z
    .string({ error: 'La fecha es obligatoria.' })
    .refine(esFechaValida, 'La fecha no es válida (AAAA-MM-DD).'),
  cantidad_personas: z.coerce
    .number({ error: 'La cantidad de personas debe ser un número.' })
    .int('La cantidad de personas debe ser un número entero.')
    .positive('La cantidad de personas debe ser mayor a 0.')
    .max(MAX_PERSONAS_POR_REGISTRO, `No se pueden registrar más de ${MAX_PERSONAS_POR_REGISTRO} personas en un pedido.`),
  menu_descripcion: texto('Lo que se va a servir', MAX_DESCRIPCION_ESPECIAL),
  receta_id: z.string().uuid('La receta seleccionada no es válida.').nullish(),
  precio_unitario: z.coerce
    .number({ error: 'El precio por persona debe ser un número.' })
    .int('El precio por persona debe ser un valor entero en pesos.')
    .positive('El precio por persona debe ser mayor a 0.')
    .max(MAX_PRECIO_ESPECIAL, 'El precio por persona es demasiado alto. Revisa el valor.'),
  observaciones: textoOpcional('Las observaciones', MAX_DESCRIPCION_ESPECIAL),
});

/** GET /api/almuerzos-especiales — todos los pedidos, del más reciente al más antiguo. */
export const getAlmuerzosEspeciales = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(`${SELECT_ESPECIAL} ORDER BY e.fecha DESC, e.created_at DESC;`);
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/almuerzos-especiales/resumen — lo que falta cobrar a los contratos (entregados sin pagar),
 * cuántos pedidos siguen programados y lo cobrado en el mes (hora de Colombia).
 */
export const getResumenAlmuerzosEspeciales = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE estado = 'entregado' AND NOT pagado)::int AS por_cobrar_cantidad,
         COALESCE(SUM(total) FILTER (WHERE estado = 'entregado' AND NOT pagado), 0)::float8 AS por_cobrar_monto,
         COUNT(*) FILTER (WHERE estado = 'programado')::int AS programados,
         COALESCE(SUM(total) FILTER (
           WHERE pagado
             AND DATE_TRUNC('month', fecha_hora_pago AT TIME ZONE 'America/Bogota')
               = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Bogota')
         ), 0)::float8 AS cobrado_mes
       FROM almuerzos_especiales;`
    );
    const fila = result.rows[0];
    return res.json({
      porCobrar: { cantidad: fila.por_cobrar_cantidad, monto: fila.por_cobrar_monto },
      programados: fila.programados,
      cobradoMes: fila.cobrado_mes,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/almuerzos-especiales — registra un pedido programado y sin pagar. El total lo calcula la BD. */
export const createAlmuerzoEspecial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = especialSchema.parse(req.body ?? {});

    const creado = await withTransaction(async (client) => {
      if (data.receta_id) {
        const receta = await client.query('SELECT 1 FROM recetas WHERE id = $1 AND activa = true;', [data.receta_id]);
        if (receta.rowCount === 0) throw new AppError('La receta seleccionada no existe.', 404);
      }
      const insert = await client.query(
        `INSERT INTO almuerzos_especiales (
           solicitante, responsable, numero_contrato, fecha, cantidad_personas,
           menu_descripcion, receta_id, precio_unitario, observaciones, creado_por
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id;`,
        [
          data.solicitante,
          data.responsable,
          data.numero_contrato,
          data.fecha,
          data.cantidad_personas,
          data.menu_descripcion,
          data.receta_id ?? null,
          data.precio_unitario,
          data.observaciones,
          req.user?.id ?? null,
        ]
      );
      const especial = await buscar(insert.rows[0].id, client);
      await registrarAuditoria(
        { usuario: req.user, accion: 'crear', entidad: 'almuerzo_especial', entidadId: especial.id, despues: especial },
        client
      );
      return especial;
    });

    return res.status(201).json(creado);
  } catch (error) {
    next(error);
  }
};

/** Pedido bloqueado para cambiarle el estado; 404 si no existe. */
const bloquear = async (client: pg.PoolClient, id: string) => {
  const actual = await client.query(
    `SELECT e.id, e.solicitante, e.estado, e.pagado, e.cantidad_personas, e.receta_id,
            TO_CHAR(e.fecha, 'YYYY-MM-DD') AS fecha, r.activa AS receta_activa
     FROM almuerzos_especiales e LEFT JOIN recetas r ON r.id = e.receta_id
     WHERE e.id = $1 FOR UPDATE OF e;`,
    [id]
  );
  if (!actual.rows[0]) throw new AppError('Almuerzo especial no encontrado.', 404);
  return actual.rows[0] as {
    id: string;
    solicitante: string;
    estado: 'programado' | 'entregado' | 'cancelado';
    pagado: boolean;
    cantidad_personas: number;
    receta_id: string | null;
    fecha: string;
    receta_activa: boolean | null;
  };
};

/**
 * PATCH /api/almuerzos-especiales/:id/entregado — programado → entregado, el día del pedido o después.
 * Descuenta de la bodega los ingredientes de su receta por cada persona (ADR 020). Sin receta no
 * descuenta nada y lo avisa en la respuesta.
 */
export const marcarEspecialEntregado = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del almuerzo especial no es válido.');
    const resultado = await withTransaction(async (client) => {
      const anterior = await bloquear(client, id);
      if (anterior.estado === 'entregado') throw new AppError('Este almuerzo especial ya está entregado.', 409);
      if (anterior.estado === 'cancelado') throw new AppError('Un almuerzo especial cancelado no se puede entregar.', 409);
      if (anterior.fecha > fechaBogota()) throw new AppError(`${MENSAJE_ENTREGA_FUTURA}.`, 409);

      await client.query(
        `UPDATE almuerzos_especiales
         SET estado = 'entregado', fecha_hora_entrega = NOW(), entregado_por = $2
         WHERE id = $1;`,
        [id, req.user!.id]
      );

      const avisos =
        anterior.receta_id && anterior.receta_activa
          ? avisosInventario(
              await descontarPorReceta(client, {
                menu: {
                  id,
                  nombre: `Almuerzo especial de ${anterior.solicitante}`,
                  receta_id: anterior.receta_id,
                  fecha: anterior.fecha,
                },
                fecha: anterior.fecha,
                porciones: anterior.cantidad_personas,
                referenciaTipo: 'almuerzo_especial',
                referenciaId: id,
                concepto: `Almuerzo especial (${anterior.solicitante}): ${anterior.cantidad_personas} persona(s)`,
                usuario: req.user,
              })
            )
          : ['El pedido no tiene receta: no se descontó inventario.'];

      const especial = await buscar(id, client);
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'marcar_entregado',
          entidad: 'almuerzo_especial',
          entidadId: id,
          antes: { estado: anterior.estado },
          despues: { estado: 'entregado', fecha_hora_entrega: especial.fecha_hora_entrega },
        },
        client
      );
      return { especial, avisos };
    });
    return res.json({ ...resultado.especial, avisos_inventario: resultado.avisos });
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/almuerzos-especiales/:id/pagado — registra el pago del contrato; desde ese momento cuenta en Ventas. */
export const marcarEspecialPagado = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del almuerzo especial no es válido.');
    const especial = await withTransaction(async (client) => {
      const anterior = await bloquear(client, id);
      if (anterior.pagado) throw new AppError('Este almuerzo especial ya está pagado.', 409);
      if (anterior.estado !== 'entregado') {
        throw new AppError('Solo se registra el pago de un almuerzo especial ya entregado.', 409);
      }
      await client.query(
        `UPDATE almuerzos_especiales
         SET pagado = TRUE, fecha_hora_pago = NOW(), pago_registrado_por = $2
         WHERE id = $1;`,
        [id, req.user!.id]
      );
      const actualizado = await buscar(id, client);
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'pagar',
          entidad: 'almuerzo_especial',
          entidadId: id,
          antes: { pagado: false },
          despues: { pagado: true, total: actualizado.total, fecha_hora_pago: actualizado.fecha_hora_pago },
        },
        client
      );
      return actualizado;
    });
    return res.json(especial);
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/almuerzos-especiales/:id/cancelado — solo un pedido programado (aún no se ha cocinado). */
export const cancelarEspecial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del almuerzo especial no es válido.');
    const especial = await withTransaction(async (client) => {
      const anterior = await bloquear(client, id);
      if (anterior.estado === 'cancelado') throw new AppError('Este almuerzo especial ya está cancelado.', 409);
      if (anterior.estado !== 'programado') {
        throw new AppError('Un almuerzo especial entregado no se puede cancelar.', 409);
      }
      await client.query("UPDATE almuerzos_especiales SET estado = 'cancelado' WHERE id = $1;", [id]);
      const actualizado = await buscar(id, client);
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'cancelar',
          entidad: 'almuerzo_especial',
          entidadId: id,
          antes: { estado: 'programado' },
          despues: { estado: 'cancelado' },
        },
        client
      );
      return actualizado;
    });
    return res.json(especial);
  } catch (error) {
    next(error);
  }
};
