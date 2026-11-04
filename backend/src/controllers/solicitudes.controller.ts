import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { withTransaction } from '../services/inventario.service.js';
import { parseId } from '../utils/validacion.js';

/**
 * Solicitudes de cuenta de instructor y encargado (ADR 015).
 * El registro público no crea estas cuentas: guarda una solicitud que cualquier
 * encargado aprueba (y entonces se crea el usuario) o rechaza.
 */

export type RolSolicitable = 'instructor' | 'encargado';

const NOMBRE_ROL: Record<RolSolicitable, string> = { instructor: 'instructor', encargado: 'encargado' };

/**
 * Guarda una solicitud pendiente. Se llama desde POST /api/auth/register cuando el tipo
 * de cuenta es instructor o encargado; la validación de los campos ya la hizo el registro.
 */
export const crearSolicitudDeCuenta = async (
  data: { name: string; document: string; email: string; password: string; accountType: RolSolicitable },
  res: Response
) => {
  const pendiente = await query(
    `SELECT cedula FROM solicitudes_cuenta
     WHERE estado = 'pendiente' AND (cedula = $1 OR lower(email) = lower($2))
     LIMIT 1;`,
    [data.document, data.email]
  );
  if (pendiente.rows.length > 0) {
    const porDocumento = pendiente.rows[0].cedula === data.document;
    return res.status(409).json({
      message: `Ya hay una solicitud pendiente con este ${porDocumento ? 'documento' : 'correo'}. Espera a que un encargado la revise.`,
    });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const insertRes = await query(
    `INSERT INTO solicitudes_cuenta (nombre, cedula, email, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, rol, estado;`,
    [data.name.trim(), data.document, data.email.trim(), passwordHash, data.accountType]
  );
  const solicitud = insertRes.rows[0];

  // 202: la cuenta todavía no existe, así que no hay token ni sesión
  return res.status(202).json({
    message: `Solicitud enviada. Un encargado del comedor debe aprobar tu cuenta de ${NOMBRE_ROL[data.accountType]} antes de que puedas ingresar.`,
    solicitud: { id: solicitud.id, rol: solicitud.rol, estado: solicitud.estado },
  });
};

/**
 * Para el login: si el documento no es un usuario pero tiene una solicitud pendiente o
 * rechazada, y la contraseña coincide, devuelve el mensaje a mostrar. Con una contraseña
 * incorrecta devuelve null y el login responde el error genérico, así no se revela nada.
 */
export const estadoDeSolicitud = async (
  documento: string,
  password: string
): Promise<{ message: string; estado_solicitud: 'pendiente' | 'rechazada' } | null> => {
  const res = await query(
    `SELECT rol, estado, motivo_rechazo, password_hash
     FROM solicitudes_cuenta
     WHERE cedula = $1 AND estado IN ('pendiente', 'rechazada')
     ORDER BY created_at DESC
     LIMIT 1;`,
    [documento]
  );
  const solicitud = res.rows[0];
  if (!solicitud || !(await bcrypt.compare(password, solicitud.password_hash))) return null;

  if (solicitud.estado === 'pendiente') {
    return {
      estado_solicitud: 'pendiente',
      message: `Tu solicitud de cuenta de ${NOMBRE_ROL[solicitud.rol as RolSolicitable]} está pendiente. Podrás ingresar cuando un encargado la apruebe.`,
    };
  }
  return {
    estado_solicitud: 'rechazada',
    message:
      'Tu solicitud de cuenta fue rechazada.' +
      (solicitud.motivo_rechazo ? ` Motivo: ${solicitud.motivo_rechazo}.` : '') +
      ' Puedes enviar una nueva solicitud o hablar con la coordinación del comedor.',
  };
};

const filtroSchema = z.enum(['pendiente', 'aprobada', 'rechazada', 'todas']).default('pendiente');

/** GET /api/solicitudes-cuenta?estado=pendiente|aprobada|rechazada|todas (encargado). */
export const getSolicitudes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const estado = filtroSchema.parse(req.query.estado ?? undefined);
    const params: string[] = [];
    let where = '';
    if (estado !== 'todas') {
      where = 'WHERE s.estado = $1';
      params.push(estado);
    }
    // Las pendientes se atienden en orden de llegada; el historial, lo más reciente primero
    const orden = estado === 'pendiente' ? 'ASC' : 'DESC';

    const result = await query(
      `SELECT s.id, s.nombre, s.cedula, s.email, s.rol, s.estado, s.motivo_rechazo,
              s.created_at, s.revisado_en, r.nombre AS revisado_por
       FROM solicitudes_cuenta s
       LEFT JOIN usuarios r ON r.id = s.revisado_por
       ${where}
       ORDER BY s.created_at ${orden};`,
      params
    );

    return res.json(
      result.rows.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        documento: s.cedula,
        email: s.email,
        rol: s.rol,
        estado: s.estado,
        motivo_rechazo: s.motivo_rechazo,
        fecha: new Date(s.created_at).toISOString(),
        revisado_por: s.revisado_por,
        revisado_en: s.revisado_en ? new Date(s.revisado_en).toISOString() : null,
      }))
    );
  } catch (error) {
    next(error);
  }
};

/** POST /api/solicitudes-cuenta/:id/aprobar (encargado): crea el usuario en la misma transacción. */
export const aprobarSolicitud = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador de la solicitud no es válido.');

    const usuario = await withTransaction(async (client) => {
      const solRes = await client.query('SELECT * FROM solicitudes_cuenta WHERE id = $1 FOR UPDATE;', [id]);
      const sol = solRes.rows[0];
      if (!sol) throw new AppError('Solicitud no encontrada.', 404);
      if (sol.estado !== 'pendiente') throw new AppError(`Esta solicitud ya fue ${sol.estado}.`, 409);

      // Pudo registrarse otra cuenta con el mismo documento o correo mientras esperaba
      const ocupado = await client.query(
        'SELECT 1 FROM usuarios WHERE cedula = $1 OR lower(email) = lower($2) LIMIT 1;',
        [sol.cedula, sol.email]
      );
      if (ocupado.rows.length > 0) {
        throw new AppError('Ya existe un usuario con este documento o correo. Rechaza esta solicitud.', 409);
      }

      const nuevoRes = await client.query(
        `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, activo)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, nombre, cedula, email, rol;`,
        [sol.nombre, sol.cedula, sol.email, sol.password_hash, sol.rol]
      );
      const nuevo = nuevoRes.rows[0];

      await client.query(
        `UPDATE solicitudes_cuenta
         SET estado = 'aprobada', revisado_por = $1, revisado_en = NOW(), usuario_id = $2
         WHERE id = $3;`,
        [req.user?.id ?? null, nuevo.id, id]
      );
      return nuevo;
    });

    return res.json({
      message: `Cuenta de ${usuario.rol} creada para ${usuario.nombre}. Ya puede iniciar sesión.`,
      usuario: { id: usuario.id, name: usuario.nombre, document: usuario.cedula, email: usuario.email, role: usuario.rol },
    });
  } catch (error) {
    next(error);
  }
};

const rechazarSchema = z.object({
  motivo: z
    .string()
    .trim()
    .max(300, 'El motivo admite máximo 300 caracteres')
    .optional()
    .transform((m) => (m ? m : null)),
});

/** POST /api/solicitudes-cuenta/:id/rechazar (encargado). Body opcional: { motivo }. */
export const rechazarSolicitud = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador de la solicitud no es válido.');
    const { motivo } = rechazarSchema.parse(req.body ?? {});

    const updateRes = await query(
      `UPDATE solicitudes_cuenta
       SET estado = 'rechazada', motivo_rechazo = $1, revisado_por = $2, revisado_en = NOW()
       WHERE id = $3 AND estado = 'pendiente'
       RETURNING id, nombre;`,
      [motivo, req.user?.id ?? null, id]
    );

    if (updateRes.rows.length === 0) {
      const existe = await query('SELECT estado FROM solicitudes_cuenta WHERE id = $1;', [id]);
      if (existe.rows.length === 0) return res.status(404).json({ message: 'Solicitud no encontrada.' });
      return res.status(409).json({ message: `Esta solicitud ya fue ${existe.rows[0].estado}.` });
    }

    return res.json({ message: `Solicitud de ${updateRes.rows[0].nombre} rechazada.` });
  } catch (error) {
    next(error);
  }
};
