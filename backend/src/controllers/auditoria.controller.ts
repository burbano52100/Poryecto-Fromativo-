import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { entreDiasBogota, rangoCampos, resolverRango } from '../utils/rango.js';

/**
 * Vista de auditoría (ADR 017), solo lectura. El encargado ve todo; el coordinador solo
 * sus propias acciones (cuentas y cargas masivas).
 */
const filtrosSchema = z.object({
  ...rangoCampos,
  usuario: z.string().trim().max(100).optional(),
  accion: z.string().trim().max(40).optional(),
  entidad: z.string().trim().max(40).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(25),
});

/** Filtros comunes: rango de fechas y, para el coordinador, solo sus propias acciones. */
const condicionesBase = (req: AuthenticatedRequest, desde: string, hasta: string) => {
  const condiciones = [entreDiasBogota('a.fecha_hora', '$1', '$2')];
  const params: unknown[] = [desde, hasta];
  if (req.user!.role === 'coordinador') {
    params.push(req.user!.id);
    condiciones.push(`a.usuario_id = $${params.length}`);
  }
  return { condiciones, params };
};

/** GET /api/auditoria?desde=&hasta=&usuario=&accion=&entidad=&pagina=&tamano= (por defecto, los últimos 30 días) */
export const listarAuditoria = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filtros = filtrosSchema.parse(req.query);
    const { desde, hasta } = resolverRango(filtros, 30);
    const { condiciones, params } = condicionesBase(req, desde, hasta);

    if (filtros.usuario) {
      params.push(`%${filtros.usuario}%`);
      condiciones.push(`a.usuario_nombre ILIKE $${params.length}`);
    }
    if (filtros.accion) {
      params.push(filtros.accion);
      condiciones.push(`a.accion = $${params.length}`);
    }
    if (filtros.entidad) {
      params.push(filtros.entidad);
      condiciones.push(`a.entidad = $${params.length}`);
    }

    params.push(filtros.tamano, (filtros.pagina - 1) * filtros.tamano);
    const result = await query(
      `SELECT a.id, a.usuario_id, a.usuario_nombre, a.rol, a.accion, a.entidad, a.entidad_id,
              a.datos_antes, a.datos_despues, a.fecha_hora, COUNT(*) OVER()::int AS total
       FROM auditoria a
       WHERE ${condiciones.join(' AND ')}
       ORDER BY a.fecha_hora DESC, a.id
       LIMIT $${params.length - 1} OFFSET $${params.length};`,
      params
    );

    return res.json({
      desde,
      hasta,
      pagina: filtros.pagina,
      tamano: filtros.tamano,
      total: result.rows[0]?.total ?? 0,
      items: result.rows.map(({ total: _total, ...fila }) => ({
        ...fila,
        fecha_hora: new Date(fila.fecha_hora).toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/auditoria/opciones — acciones y entidades registradas, para los filtros. */
export const opcionesAuditoria = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const propias = req.user!.role === 'coordinador';
    const where = propias ? 'WHERE usuario_id = $1' : '';
    const params = propias ? [req.user!.id] : [];
    const [acciones, entidades] = await Promise.all([
      query(`SELECT DISTINCT accion FROM auditoria ${where} ORDER BY accion;`, params),
      query(`SELECT DISTINCT entidad FROM auditoria ${where} ORDER BY entidad;`, params),
    ]);
    return res.json({
      acciones: acciones.rows.map((r) => r.accion as string),
      entidades: entidades.rows.map((r) => r.entidad as string),
    });
  } catch (error) {
    next(error);
  }
};
