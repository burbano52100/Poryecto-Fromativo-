import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { parseId } from '../utils/validacion.js';
import { withTransaction } from '../services/inventario.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';
import { finalizarBeneficiosDeUsuarios } from '../services/beneficios.service.js';
import { hashClaveInicial } from '../services/cuentas.service.js';

/**
 * Coordinador (ADR 018): administra las cuentas de instructores y aprendices. No ve ventas,
 * inventario, deudas ni cierres de caja.
 */
const ROLES_GESTIONADOS = ['instructor', 'aprendiz'] as const;

const idsSchema = z
  .array(z.string().uuid('Una de las solicitudes no es válida.'), { error: 'Selecciona al menos una solicitud.' })
  .min(1, 'Selecciona al menos una solicitud.')
  .max(200, 'Puedes revisar como máximo 200 solicitudes a la vez.');

const aprobarSchema = z.object({ ids: idsSchema });
const rechazarSchema = z.object({
  ids: idsSchema,
  motivo: z
    .string({ error: 'Escribe el motivo del rechazo.' })
    .trim()
    .min(3, 'Escribe el motivo del rechazo (mínimo 3 caracteres).')
    .max(300, 'El motivo no puede superar 300 caracteres.'),
});

export const filtrosUsuariosSchema = z.object({
  rol: z.enum(ROLES_GESTIONADOS).optional(),
  estado: z.enum(['pendiente', 'activo', 'inactivo', 'rechazado']).optional(),
  ficha: z.string().trim().max(20).optional(),
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(200).default(50),
});

const estadoUsuarioSchema = z.object({
  estado: z.enum(['activo', 'inactivo'], { error: "El estado debe ser 'activo' o 'inactivo'." }),
});

const estadoFichaSchema = z.object({
  estado: z.enum(['activa', 'finalizada'], { error: "El estado de la ficha debe ser 'activa' o 'finalizada'." }),
});

const SELECT_CUENTA = `
  SELECT u.id, u.nombre, u.cedula, u.email, u.telefono, u.rol, u.estado, u.origen, u.debe_cambiar_clave,
         u.motivo_rechazo, u.fecha_aprobacion, u.created_at, f.codigo_ficha AS ficha, f.programa
  FROM usuarios u
  LEFT JOIN fichas f ON f.id = u.ficha_id`;

const formatearCuenta = (u: Record<string, any>) => ({
  ...u,
  fecha_aprobacion: u.fecha_aprobacion ? new Date(u.fecha_aprobacion).toISOString() : null,
  created_at: new Date(u.created_at).toISOString(),
});

/** GET /api/coordinador/resumen — indicadores del encabezado. */
export const getResumenCoordinador = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT COUNT(*) FILTER (WHERE estado = 'activo')::int AS activos,
              COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
              COUNT(*) FILTER (WHERE rol = 'instructor' AND estado = 'activo')::int AS instructores,
              COUNT(*) FILTER (WHERE rol = 'aprendiz' AND estado = 'activo')::int AS aprendices
       FROM usuarios
       WHERE rol IN ('instructor', 'aprendiz');`
    );
    return res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

/** GET /api/coordinador/solicitudes?q= — instructores y aprendices pendientes, el más antiguo primero. */
export const getSolicitudes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const result = await query(
      `${SELECT_CUENTA}
       WHERE u.estado = 'pendiente' AND u.rol IN ('instructor', 'aprendiz')
         AND ($1 = '' OR u.nombre ILIKE '%' || $1 || '%' OR u.cedula LIKE $1 || '%' OR u.email ILIKE '%' || $1 || '%')
       ORDER BY u.created_at ASC;`,
      [q]
    );
    return res.json(result.rows.map(formatearCuenta));
  } catch (error) {
    next(error);
  }
};

/** POST /api/coordinador/solicitudes/aprobar — body: { ids }. Las cuentas quedan activas. */
export const aprobarSolicitudes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { ids } = aprobarSchema.parse(req.body ?? {});
    const aprobadas = await withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE usuarios
         SET estado = 'activo', aprobado_por = $2, fecha_aprobacion = NOW(), motivo_rechazo = NULL, updated_at = NOW()
         WHERE id = ANY($1::uuid[]) AND estado = 'pendiente' AND rol IN ('instructor', 'aprendiz')
         RETURNING id, nombre, cedula, rol;`,
        [ids, req.user!.id]
      );
      for (const cuenta of res.rows) {
        await registrarAuditoria(
          {
            usuario: req.user,
            accion: 'aprobar',
            entidad: 'cuenta',
            entidadId: cuenta.id,
            antes: { estado: 'pendiente' },
            despues: { estado: 'activo', nombre: cuenta.nombre, cedula: cuenta.cedula, rol: cuenta.rol },
          },
          client
        );
      }
      return res.rows;
    });
    if (aprobadas.length === 0) throw new AppError('Ninguna de las solicitudes seleccionadas sigue pendiente.', 409);
    return res.json({
      message: aprobadas.length === 1 ? `Se aprobó la cuenta de ${aprobadas[0].nombre}.` : `Se aprobaron ${aprobadas.length} cuentas.`,
      aprobadas: aprobadas.length,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/coordinador/solicitudes/rechazar — body: { ids, motivo }. El motivo se muestra al intentar ingresar. */
export const rechazarSolicitudes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { ids, motivo } = rechazarSchema.parse(req.body ?? {});
    const rechazadas = await withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE usuarios
         SET estado = 'rechazado', motivo_rechazo = $2, aprobado_por = $3, fecha_aprobacion = NOW(), updated_at = NOW()
         WHERE id = ANY($1::uuid[]) AND estado = 'pendiente' AND rol IN ('instructor', 'aprendiz')
         RETURNING id, nombre, cedula, rol;`,
        [ids, motivo, req.user!.id]
      );
      for (const cuenta of res.rows) {
        await registrarAuditoria(
          {
            usuario: req.user,
            accion: 'rechazar',
            entidad: 'cuenta',
            entidadId: cuenta.id,
            antes: { estado: 'pendiente' },
            despues: { estado: 'rechazado', motivo, nombre: cuenta.nombre, cedula: cuenta.cedula, rol: cuenta.rol },
          },
          client
        );
      }
      return res.rows;
    });
    if (rechazadas.length === 0) throw new AppError('Ninguna de las solicitudes seleccionadas sigue pendiente.', 409);
    return res.json({
      message: rechazadas.length === 1 ? `Se rechazó la solicitud de ${rechazadas[0].nombre}.` : `Se rechazaron ${rechazadas.length} solicitudes.`,
      rechazadas: rechazadas.length,
    });
  } catch (error) {
    next(error);
  }
};

/** Filtros de la lista de usuarios (también los usa el reporte de usuarios). */
export const condicionesUsuarios = (filtros: z.infer<typeof filtrosUsuariosSchema>) => {
  const condiciones = ["u.rol IN ('instructor', 'aprendiz')"];
  const params: unknown[] = [];
  const agregar = (sql: (n: number) => string, valor: unknown) => {
    params.push(valor);
    condiciones.push(sql(params.length));
  };
  if (filtros.rol) agregar((n) => `u.rol = $${n}`, filtros.rol);
  if (filtros.estado) agregar((n) => `u.estado = $${n}`, filtros.estado);
  if (filtros.ficha) agregar((n) => `f.codigo_ficha = $${n}`, filtros.ficha);
  if (filtros.q) agregar((n) => `(u.nombre ILIKE '%' || $${n} || '%' OR u.cedula LIKE $${n} || '%')`, filtros.q);
  return { where: condiciones.join(' AND '), params };
};

/** GET /api/coordinador/usuarios?rol=&estado=&ficha=&q=&pagina=&tamano= */
export const getUsuarios = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filtros = filtrosUsuariosSchema.parse(req.query);
    const { where, params } = condicionesUsuarios(filtros);
    params.push(filtros.tamano, (filtros.pagina - 1) * filtros.tamano);
    const result = await query(
      `${SELECT_CUENTA.replace('SELECT u.id', 'SELECT COUNT(*) OVER()::int AS total, u.id')}
       WHERE ${where}
       ORDER BY u.nombre ASC
       LIMIT $${params.length - 1} OFFSET $${params.length};`,
      params
    );
    return res.json({
      total: result.rows[0]?.total ?? 0,
      pagina: filtros.pagina,
      tamano: filtros.tamano,
      items: result.rows.map(({ total: _total, ...u }) => formatearCuenta(u)),
    });
  } catch (error) {
    next(error);
  }
};

/** Cuenta de instructor o aprendiz bloqueada para actualizarla. */
const cuentaGestionada = async (client: Pick<import('pg').PoolClient, 'query'>, id: string) => {
  const res = await client.query(
    `SELECT id, nombre, cedula, rol, estado FROM usuarios
     WHERE id = $1 AND rol IN ('instructor', 'aprendiz') FOR UPDATE;`,
    [id]
  );
  if (!res.rows[0]) throw new AppError('No se encontró la cuenta del instructor o aprendiz.', 404);
  return res.rows[0] as { id: string; nombre: string; cedula: string; rol: string; estado: string };
};

/**
 * PATCH /api/coordinador/usuarios/:id/estado — body: { estado: 'activo' | 'inactivo' }.
 * Desactivar a un aprendiz finaliza su beneficio y avisa al encargado.
 */
export const cambiarEstadoUsuario = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador de la cuenta no es válido.');
    const { estado } = estadoUsuarioSchema.parse(req.body ?? {});

    const resultado = await withTransaction(async (client) => {
      const cuenta = await cuentaGestionada(client, id);
      if (cuenta.estado === estado) {
        throw new AppError(`La cuenta ya está ${estado === 'activo' ? 'activa' : 'inactiva'}.`, 409);
      }
      if (cuenta.estado === 'pendiente' || cuenta.estado === 'rechazado') {
        throw new AppError('Esta cuenta aún no ha sido aprobada: revísala en Solicitudes.', 409);
      }
      await client.query('UPDATE usuarios SET estado = $1, updated_at = NOW() WHERE id = $2;', [estado, id]);
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: estado === 'activo' ? 'activar' : 'desactivar',
          entidad: 'cuenta',
          entidadId: id,
          antes: { estado: cuenta.estado },
          despues: { estado, nombre: cuenta.nombre, cedula: cuenta.cedula, rol: cuenta.rol },
        },
        client
      );
      const beneficios =
        estado === 'inactivo' && cuenta.rol === 'aprendiz'
          ? await finalizarBeneficiosDeUsuarios(client, [id], 'cuenta_desactivada', req.user)
          : 0;
      return { cuenta, beneficios };
    });

    const avisoBeneficio = resultado.beneficios > 0 ? ' Se finalizó su beneficio de almuerzo y se avisó al Encargado.' : '';
    return res.json({
      message: `${resultado.cuenta.nombre} quedó ${estado === 'activo' ? 'activo' : 'inactivo'}.${avisoBeneficio}`,
      estado,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/coordinador/usuarios/:id/restablecer-clave — la contraseña vuelve a ser la cédula, con cambio obligatorio. */
export const restablecerClave = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador de la cuenta no es válido.');
    const cuenta = await withTransaction(async (client) => {
      const cuenta = await cuentaGestionada(client, id);
      await client.query(
        'UPDATE usuarios SET password_hash = $1, debe_cambiar_clave = true, updated_at = NOW() WHERE id = $2;',
        [await hashClaveInicial(cuenta.cedula), id]
      );
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'restablecer_clave',
          entidad: 'cuenta',
          entidadId: id,
          despues: { nombre: cuenta.nombre, cedula: cuenta.cedula, debe_cambiar_clave: true },
        },
        client
      );
      return cuenta;
    });
    return res.json({
      message: `La contraseña de ${cuenta.nombre} volvió a ser su número de documento. Deberá cambiarla al ingresar.`,
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/coordinador/fichas — fichas con su estado y cantidad de aprendices. */
export const getFichas = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT f.id, f.codigo_ficha, f.programa, f.jornada, f.estado,
              COUNT(u.id) FILTER (WHERE u.rol = 'aprendiz' AND u.estado = 'activo')::int AS aprendices
       FROM fichas f
       LEFT JOIN usuarios u ON u.ficha_id = f.id
       GROUP BY f.id
       ORDER BY f.codigo_ficha;`
    );
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/coordinador/fichas/:id/estado — body: { estado: 'activa' | 'finalizada' }.
 * Al finalizar una ficha terminan los beneficios de sus aprendices y se avisa al encargado.
 */
export const cambiarEstadoFicha = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador de la ficha no es válido.');
    const { estado } = estadoFichaSchema.parse(req.body ?? {});
    const resultado = await withTransaction(async (client) => {
      const fichaRes = await client.query('SELECT id, codigo_ficha, estado FROM fichas WHERE id = $1 FOR UPDATE;', [id]);
      const ficha = fichaRes.rows[0];
      if (!ficha) throw new AppError('Ficha no encontrada.', 404);
      if (ficha.estado === estado) throw new AppError(`La ficha ya está ${estado}.`, 409);
      await client.query('UPDATE fichas SET estado = $1 WHERE id = $2;', [estado, id]);
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'cambiar_estado',
          entidad: 'ficha',
          entidadId: id,
          antes: { estado: ficha.estado },
          despues: { estado, codigo_ficha: ficha.codigo_ficha },
        },
        client
      );
      let beneficios = 0;
      if (estado === 'finalizada') {
        const aprendices = await client.query("SELECT id FROM usuarios WHERE ficha_id = $1 AND rol = 'aprendiz';", [id]);
        beneficios = await finalizarBeneficiosDeUsuarios(
          client,
          aprendices.rows.map((a) => a.id),
          'ficha_finalizada',
          req.user
        );
      }
      return { ficha, beneficios };
    });
    const aviso = resultado.beneficios > 0 ? ` Terminaron ${resultado.beneficios} beneficio(s) y se avisó al Encargado.` : '';
    return res.json({ message: `La ficha ${resultado.ficha.codigo_ficha} quedó ${estado}.${aviso}` });
  } catch (error) {
    next(error);
  }
};
