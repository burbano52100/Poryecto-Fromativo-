import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { parseId } from '../utils/validacion.js';
import { esFechaValida, fechaBogota, instanteEnBogota } from '../utils/horario.js';
import { withTransaction } from '../services/inventario.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';
import { verificarDiaAbierto } from '../services/cierreCaja.service.js';
import {
  avisosInventario,
  descontarPorReceta,
  menuDeFecha,
  revertirDescuento,
} from '../services/descuentoReceta.service.js';
import type pg from 'pg';
import {
  MAX_PERSONAS_POR_REGISTRO,
  TARIFAS_ALMUERZO_INVITADO,
  TIPOS_ALMUERZO_INVITADO,
  type TipoAlmuerzoInvitado,
} from '../config/almuerzosInvitados.js';

/**
 * Almuerzos Invitados (ADR 016): el encargado registra los almuerzos vendidos a invitados
 * en tres tipos con tarifa fija. El precio lo fija siempre el servidor con la tarifa vigente
 * y queda copiado en el registro.
 */

// ---------------------------------------------------------------- Validaciones

const tipoSchema = z.enum(TIPOS_ALMUERZO_INVITADO, {
  error: 'El tipo de almuerzo no es válido. Usa: instructor, aprendiz o corriente.',
});

const MENSAJE_ENTERO = 'El número de personas debe ser un número entero.';

const personasSchema = z
  .number({ error: MENSAJE_ENTERO })
  .int(MENSAJE_ENTERO)
  .min(1, 'El número de personas debe ser mayor a 0.')
  .max(MAX_PERSONAS_POR_REGISTRO, `El número de personas no puede superar ${MAX_PERSONAS_POR_REGISTRO} por registro.`);

const nombreSchema = z
  .string({ error: 'El nombre del invitado debe ser texto.' })
  .trim()
  .max(120, 'El nombre del invitado no puede superar 120 caracteres.')
  .nullish()
  .transform((nombre) => nombre || null);

/** 'YYYY-MM-DDTHH:mm' en hora de Colombia, que no sea futura. */
const fechaHoraSchema = z.string({ error: 'La fecha y hora es obligatoria.' }).transform((valor, ctx) => {
  const instante = instanteEnBogota(valor);
  if (!instante) {
    ctx.addIssue({ code: 'custom', message: 'La fecha y hora no es válida (formato AAAA-MM-DDTHH:mm).' });
    return z.NEVER;
  }
  if (instante.getTime() > Date.now()) {
    ctx.addIssue({ code: 'custom', message: 'La fecha y hora no puede ser futura.' });
    return z.NEVER;
  }
  return instante;
});

const crearSchema = z.object({
  tipo: tipoSchema,
  cantidad: personasSchema,
  nombre_invitado: nombreSchema,
});

const editarSchema = z.object({
  cantidad: personasSchema,
  nombre_invitado: nombreSchema,
  fecha_hora: fechaHoraSchema,
});

const fechaSchema = (campo: string) =>
  z.string({ error: `${campo} debe ser una fecha (AAAA-MM-DD).` }).refine(esFechaValida, `${campo} no es una fecha válida (AAAA-MM-DD).`);

/** Rango de días en hora de Colombia. Sin `hasta` se usa hoy; sin `desde`, el mismo día de `hasta`. */
const rangoSchema = z
  .object({
    desde: fechaSchema('La fecha inicial').optional(),
    hasta: fechaSchema('La fecha final').optional(),
    tipo: tipoSchema.optional(),
  })
  .transform(({ desde, hasta, tipo }) => {
    const fin = hasta ?? fechaBogota();
    return { desde: desde ?? fin, hasta: fin, tipo: tipo ?? null };
  })
  .refine((rango) => rango.desde <= rango.hasta, {
    message: 'La fecha inicial no puede ser posterior a la fecha final.',
    path: ['desde'],
  });

// ---------------------------------------------------------------- Consultas

/** Registros cuyo instante cae entre el inicio del día `desde` y el final del día `hasta` (hora de Colombia). */
const entreDias = (desde: string, hasta: string, alias = 'a') =>
  `${alias}.fecha_hora >= (${desde}::date::timestamp AT TIME ZONE 'America/Bogota')
   AND ${alias}.fecha_hora < ((${hasta}::date + 1)::timestamp AT TIME ZONE 'America/Bogota')`;

const SELECT_REGISTRO = `
  SELECT a.id, a.tipo, a.cantidad,
         a.precio_unitario::float8 AS precio_unitario, a.total::float8 AS total,
         a.nombre_invitado, a.registrado_por, u.nombre AS registrado_por_nombre,
         a.fecha_hora,
         TO_CHAR(a.fecha_hora AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI') AS fecha_local,
         EXISTS (SELECT 1 FROM cierres_caja c
                 WHERE c.estado = 'cerrado' AND c.fecha = (a.fecha_hora AT TIME ZONE 'America/Bogota')::date) AS dia_cerrado
  FROM almuerzos_invitados a
  LEFT JOIN usuarios u ON u.id = a.registrado_por`;

interface FilaRegistro {
  id: string;
  tipo: TipoAlmuerzoInvitado;
  cantidad: number;
  precio_unitario: number;
  total: number;
  nombre_invitado: string | null;
  registrado_por: string;
  registrado_por_nombre: string | null;
  fecha_hora: Date;
  fecha_local: string;
  dia_cerrado: boolean;
}

const formatearRegistro = (fila: FilaRegistro) => ({
  id: fila.id,
  tipo: fila.tipo,
  cantidad: fila.cantidad,
  precio_unitario: fila.precio_unitario,
  total: fila.total,
  nombre_invitado: fila.nombre_invitado,
  registrado_por: { id: fila.registrado_por, nombre: fila.registrado_por_nombre },
  fecha_hora: new Date(fila.fecha_hora).toISOString(),
  fecha_local: fila.fecha_local,
  // Si la caja de ese día está cerrada, el registro no se puede editar ni eliminar (ADR 021)
  dia_cerrado: Boolean(fila.dia_cerrado),
});

type Queryable = Pick<pg.PoolClient, 'query'>;

const buscarRegistro = async (id: string, db?: Queryable) => {
  const sql = `${SELECT_REGISTRO} WHERE a.id = $1;`;
  const res = db ? await db.query<FilaRegistro>(sql, [id]) : await query<FilaRegistro>(sql, [id]);
  if (!res.rows[0]) throw new AppError('Registro de almuerzo invitado no encontrado.', 404);
  return formatearRegistro(res.rows[0]);
};

// ---------------------------------------------------------------- Endpoints

/** GET /api/almuerzos-invitados/tarifas */
export const getTarifas = (_req: AuthenticatedRequest, res: Response) =>
  res.json({
    tarifas: TIPOS_ALMUERZO_INVITADO.map((tipo) => ({ tipo, precio: TARIFAS_ALMUERZO_INVITADO[tipo] })),
    maxPersonas: MAX_PERSONAS_POR_REGISTRO,
  });

/** GET /api/almuerzos-invitados?desde=&hasta=&tipo= — historial, el más reciente primero. */
export const listarAlmuerzosInvitados = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { desde, hasta, tipo } = rangoSchema.parse(req.query);
    const result = await query<FilaRegistro>(
      `${SELECT_REGISTRO}
       WHERE ${entreDias('$1', '$2')}
         AND ($3::tipo_almuerzo_invitado IS NULL OR a.tipo = $3::tipo_almuerzo_invitado)
       ORDER BY a.fecha_hora DESC, a.created_at DESC;`,
      [desde, hasta, tipo]
    );
    return res.json(result.rows.map(formatearRegistro));
  } catch (error) {
    next(error);
  }
};

interface Totales {
  personas: number;
  total: number;
  registros: number;
}

const sumar = (porTipo: Record<TipoAlmuerzoInvitado, Totales>): Totales =>
  Object.values(porTipo).reduce(
    (acc, t) => ({ personas: acc.personas + t.personas, total: acc.total + t.total, registros: acc.registros + t.registros }),
    { personas: 0, total: 0, registros: 0 }
  );

/**
 * GET /api/almuerzos-invitados/resumen?desde=&hasta=
 * Personas y pesos de hoy y del período, por tipo y en total. Los tres tipos vienen siempre, aunque estén en cero.
 */
export const getResumenAlmuerzosInvitados = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { desde, hasta } = rangoSchema.parse(req.query);
    const hoy = fechaBogota();

    const result = await query<{
      tipo: TipoAlmuerzoInvitado;
      personas_dia: number;
      total_dia: number;
      registros_dia: number;
      personas_periodo: number;
      total_periodo: number;
      registros_periodo: number;
    }>(
      `SELECT a.tipo,
              COALESCE(SUM(a.cantidad) FILTER (WHERE ${entreDias('$1', '$1')}), 0)::int AS personas_dia,
              COALESCE(SUM(a.total) FILTER (WHERE ${entreDias('$1', '$1')}), 0)::float8 AS total_dia,
              COUNT(*) FILTER (WHERE ${entreDias('$1', '$1')})::int AS registros_dia,
              COALESCE(SUM(a.cantidad) FILTER (WHERE ${entreDias('$2', '$3')}), 0)::int AS personas_periodo,
              COALESCE(SUM(a.total) FILTER (WHERE ${entreDias('$2', '$3')}), 0)::float8 AS total_periodo,
              COUNT(*) FILTER (WHERE ${entreDias('$2', '$3')})::int AS registros_periodo
       FROM almuerzos_invitados a
       WHERE (${entreDias('$1', '$1')}) OR (${entreDias('$2', '$3')})
       GROUP BY a.tipo;`,
      [hoy, desde, hasta]
    );

    const vacio = (): Totales => ({ personas: 0, total: 0, registros: 0 });
    const dia = Object.fromEntries(TIPOS_ALMUERZO_INVITADO.map((t) => [t, vacio()])) as Record<TipoAlmuerzoInvitado, Totales>;
    const periodo = Object.fromEntries(TIPOS_ALMUERZO_INVITADO.map((t) => [t, vacio()])) as Record<TipoAlmuerzoInvitado, Totales>;

    for (const fila of result.rows) {
      dia[fila.tipo] = { personas: fila.personas_dia, total: fila.total_dia, registros: fila.registros_dia };
      periodo[fila.tipo] = { personas: fila.personas_periodo, total: fila.total_periodo, registros: fila.registros_periodo };
    }

    return res.json({
      hoy,
      desde,
      hasta,
      dia: { porTipo: dia, ...sumar(dia) },
      periodo: { porTipo: periodo, ...sumar(periodo) },
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/almuerzos-invitados — body: { tipo, cantidad, nombre_invitado? }. */
export const crearAlmuerzoInvitado = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = crearSchema.parse(req.body ?? {});
    // El precio sale de la tarifa vigente; cualquier precio enviado por el cliente se ignora
    const precioUnitario = TARIFAS_ALMUERZO_INVITADO[data.tipo];
    const hoy = fechaBogota();

    const { registro, avisos } = await withTransaction(async (client) => {
      await verificarDiaAbierto(hoy, client);
      const insertRes = await client.query<{ id: string }>(
        `INSERT INTO almuerzos_invitados (tipo, cantidad, precio_unitario, nombre_invitado, registrado_por)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id;`,
        [data.tipo, data.cantidad, precioUnitario, data.nombre_invitado, req.user!.id]
      );
      const registro = await buscarRegistro(insertRes.rows[0].id, client);
      // Cada persona descuenta una porción de la receta del menú de hoy (ADR 020)
      const descuento = await descontarPorReceta(client, {
        menu: await menuDeFecha(client, hoy),
        fecha: hoy,
        porciones: data.cantidad,
        referenciaTipo: 'almuerzo_invitado',
        referenciaId: registro.id,
        concepto: `Almuerzos invitados (${data.tipo}): ${data.cantidad} persona(s)`,
        usuario: req.user,
      });
      await registrarAuditoria(
        { usuario: req.user, accion: 'crear', entidad: 'almuerzo_invitado', entidadId: registro.id, despues: registro },
        client
      );
      return { registro, avisos: avisosInventario(descuento) };
    });

    return res.status(201).json({ ...registro, avisos_inventario: avisos });
  } catch (error) {
    next(error);
  }
};

/** Registro bloqueado para editarlo o eliminarlo, con la fecha (Colombia) en que quedó. */
const registroParaCambiar = async (client: pg.PoolClient, id: string) => {
  const actual = await client.query(
    `SELECT id, tipo, cantidad, nombre_invitado,
            TO_CHAR(fecha_hora AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha
     FROM almuerzos_invitados WHERE id = $1 FOR UPDATE;`,
    [id]
  );
  if (!actual.rows[0]) throw new AppError('Registro de almuerzo invitado no encontrado.', 404);
  return actual.rows[0] as { id: string; tipo: TipoAlmuerzoInvitado; cantidad: number; nombre_invitado: string | null; fecha: string };
};

/**
 * PUT /api/almuerzos-invitados/:id — body: { cantidad, nombre_invitado?, fecha_hora }.
 * El tipo y el precio unitario no cambian: el total se recalcula con el precio guardado.
 */
export const editarAlmuerzoInvitado = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del registro no es válido.');
    const data = editarSchema.parse(req.body ?? {});
    const nuevaFecha = fechaBogota(data.fecha_hora);

    const { registro, avisos } = await withTransaction(async (client) => {
      const anterior = await registroParaCambiar(client, id);
      const antes = await buscarRegistro(id, client);
      // Ni el día original ni el nuevo pueden tener la caja cerrada (ADR 021)
      await verificarDiaAbierto(anterior.fecha, client);
      if (nuevaFecha !== anterior.fecha) await verificarDiaAbierto(nuevaFecha, client);

      await client.query(
        `UPDATE almuerzos_invitados
         SET cantidad = $1, nombre_invitado = $2, fecha_hora = $3
         WHERE id = $4;`,
        [data.cantidad, data.nombre_invitado, data.fecha_hora, id]
      );

      // Si cambian las personas o el día, se devuelve lo descontado y se descuenta de nuevo
      let avisos: string[] = [];
      if (data.cantidad !== anterior.cantidad || nuevaFecha !== anterior.fecha) {
        await revertirDescuento(client, {
          referenciaTipo: 'almuerzo_invitado',
          referenciaId: id,
          concepto: `Edición de almuerzos invitados (${anterior.tipo}): se reversan ${anterior.cantidad} persona(s)`,
          usuario: req.user,
        });
        const descuento = await descontarPorReceta(client, {
          menu: await menuDeFecha(client, nuevaFecha),
          fecha: nuevaFecha,
          porciones: data.cantidad,
          referenciaTipo: 'almuerzo_invitado',
          referenciaId: id,
          concepto: `Almuerzos invitados (${anterior.tipo}) editado: ${data.cantidad} persona(s)`,
          usuario: req.user,
        });
        avisos = avisosInventario(descuento);
      }

      const registro = await buscarRegistro(id, client);
      await registrarAuditoria(
        { usuario: req.user, accion: 'editar', entidad: 'almuerzo_invitado', entidadId: id, antes, despues: registro },
        client
      );
      return { registro, avisos };
    });

    return res.json({ ...registro, avisos_inventario: avisos });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/almuerzos-invitados/:id */
export const eliminarAlmuerzoInvitado = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del registro no es válido.');
    await withTransaction(async (client) => {
      const anterior = await registroParaCambiar(client, id);
      const antes = await buscarRegistro(id, client);
      await verificarDiaAbierto(anterior.fecha, client);
      await revertirDescuento(client, {
        referenciaTipo: 'almuerzo_invitado',
        referenciaId: id,
        concepto: `Registro de almuerzos invitados eliminado (${anterior.tipo}, ${anterior.cantidad} persona(s))`,
        usuario: req.user,
      });
      await client.query('DELETE FROM almuerzos_invitados WHERE id = $1;', [id]);
      await registrarAuditoria(
        { usuario: req.user, accion: 'eliminar', entidad: 'almuerzo_invitado', entidadId: id, antes },
        client
      );
    });
    return res.json({ message: 'Registro de almuerzo invitado eliminado.' });
  } catch (error) {
    next(error);
  }
};
