import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { registrarAuditoria } from '../services/auditoria.service.js';
import { buscarOCrearFicha } from '../services/cuentas.service.js';

// El rol no se pide: sale de usuarios.rol en la base de datos.
const loginSchema = z.object({
  document: z.string().trim().min(4, 'El documento debe tener al menos 4 dígitos'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

/**
 * Registro público (ADR 018): solo aprendices e instructores. La cuenta queda pendiente hasta
 * que el coordinador la apruebe. Coordinadores y encargados los crea el equipo (seed).
 */
const registerSchema = z
  .object({
    name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(150),
    document: z.string().regex(/^\d{6,12}$/, 'El documento debe contener entre 6 y 12 números'),
    accountType: z.enum(['aprendiz', 'instructor'], {
      error: 'El tipo de cuenta no es válido. Usa: aprendiz o instructor.',
    }),
    ficha: z.string().trim().optional(),
    email: z.string().trim().email('Ingresa un correo electrónico válido').max(150),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  })
  .refine((data) => data.accountType !== 'aprendiz' || /^\d{5,12}$/.test(data.ficha ?? ''), {
    message: 'El número de ficha (entre 5 y 12 dígitos) es obligatorio para aprendices',
    path: ['ficha'],
  });

const cambiarClaveSchema = z
  .object({
    actual: z.string().min(1, 'Escribe tu contraseña actual.'),
    nueva: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres.').max(72),
  })
  .refine((data) => data.actual !== data.nueva, {
    message: 'La nueva contraseña debe ser distinta de la actual.',
    path: ['nueva'],
  });

/** Mensajes del login para las cuentas que no están activas. */
const MENSAJE_ESTADO: Record<string, string> = {
  pendiente: 'Tu cuenta está pendiente de aprobación del Coordinador.',
  rechazado: 'Tu solicitud fue rechazada.',
  inactivo: 'Tu cuenta está desactivada.',
};

interface FilaUsuario {
  id: string;
  nombre: string;
  cedula: string;
  email: string | null;
  rol: string;
  estado: string;
  es_beneficiario: boolean;
  debe_cambiar_clave: boolean;
  codigo_ficha: string | null;
}

/** Usuario tal como lo reciben el frontend y el JWT. */
const usuarioPublico = (u: FilaUsuario) => ({
  id: u.id,
  document: u.cedula,
  name: u.nombre,
  role: u.rol,
  email: u.email || '',
  ficha: u.codigo_ficha || undefined,
  status: u.estado === 'activo' ? 'ACTIVE' : 'INACTIVE',
  es_beneficiario: Boolean(u.es_beneficiario),
  debe_cambiar_clave: Boolean(u.debe_cambiar_clave),
});

const SELECT_USUARIO = `
  SELECT u.id, u.nombre, u.cedula, u.email, u.password_hash, u.rol, u.estado, u.motivo_rechazo,
         u.es_beneficiario, u.debe_cambiar_clave, f.id as ficha_id, f.codigo_ficha
  FROM usuarios u
  LEFT JOIN fichas f ON u.ficha_id = f.id`;

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { document, password } = loginSchema.parse(req.body);

    const userRes = await query(`${SELECT_USUARIO} WHERE u.cedula = $1;`, [document]);
    const user = userRes.rows[0];

    // Mensaje genérico: no revela si falló el documento o la contraseña
    const genericError = () => res.status(401).json({ message: 'Credenciales inválidas' });

    if (!user?.password_hash) return genericError();
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) return genericError();

    // Con la contraseña correcta se explica por qué la cuenta no puede entrar (ADR 018)
    if (user.estado !== 'activo') {
      const motivo = user.estado === 'rechazado' && user.motivo_rechazo ? ` Motivo: ${user.motivo_rechazo}` : '';
      return res.status(403).json({
        message: `${MENSAJE_ESTADO[user.estado] ?? 'Tu cuenta no está activa.'}${motivo}`,
        estado_cuenta: user.estado,
      });
    }

    return res.json({ token: firmarSesion(user), user: usuarioPublico(user), message: 'Inicio de sesión exitoso' });
  } catch (error) {
    next(error);
  }
};

const firmarSesion = (user: FilaUsuario & { ficha_id: string | null }) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET no configurado en el servidor');
  return jwt.sign(
    { id: user.id, document: user.cedula, name: user.nombre, role: user.rol, email: user.email, ficha_id: user.ficha_id },
    jwtSecret,
    { expiresIn: '7d' }
  );
};

/**
 * POST /api/auth/register — el aprendiz y el instructor quedan pendientes (202, sin sesión)
 * hasta que el coordinador los apruebe.
 * Si la cédula está en una lista que cargó el coordinador (carga masiva) y la cuenta aún no se ha
 * usado, el registro la activa con la contraseña elegida y abre la sesión (201). El correo debe
 * coincidir con el cargado, para que nadie active la cuenta de otra persona solo con su cédula.
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await query(
      `SELECT id, cedula, lower(email) AS email, origen, rol, estado, debe_cambiar_clave
       FROM usuarios WHERE cedula = $1 OR lower(email) = lower($2)
       ORDER BY (cedula = $1) DESC LIMIT 1;`,
      [data.document, data.email]
    );

    if (existingUser.rows.length > 0) {
      const match = existingUser.rows[0];
      const cargadaSinUsar =
        match.cedula === data.document &&
        match.origen === 'carga_masiva' &&
        match.estado === 'activo' &&
        match.debe_cambiar_clave;
      if (cargadaSinUsar) {
        if (match.rol !== data.accountType || match.email !== data.email.toLowerCase()) {
          return res.status(409).json({
            message:
              'El Coordinador ya cargó tu cuenta con otros datos. Ingresa con tu número de documento (tu contraseña inicial también es tu número de documento) o pide ayuda al Coordinador.',
          });
        }
        const passwordHash = await bcrypt.hash(data.password, 10);
        await query(
          'UPDATE usuarios SET password_hash = $1, debe_cambiar_clave = false, updated_at = NOW() WHERE id = $2;',
          [passwordHash, match.id]
        );
        const userRes = await query(`${SELECT_USUARIO} WHERE u.id = $1;`, [match.id]);
        const user = userRes.rows[0];
        await registrarAuditoria({
          usuario: { id: user.id, name: user.nombre, role: user.rol },
          accion: 'activar',
          entidad: 'cuenta',
          entidadId: user.id,
          antes: { origen: 'carga_masiva', debe_cambiar_clave: true },
          despues: { debe_cambiar_clave: false, via: 'registro' },
        });
        return res.status(201).json({
          token: firmarSesion(user),
          user: usuarioPublico(user),
          message: 'Tu cédula estaba en la lista del Coordinador: tu cuenta quedó activa.',
        });
      }
      if (match.cedula === data.document) {
        return res.status(409).json({ message: 'Ya existe un usuario con este número de documento.' });
      }
      return res.status(409).json({ message: 'Ya existe un usuario con este correo electrónico.' });
    }

    const fichaId = data.accountType === 'aprendiz' ? (await buscarOCrearFicha(data.ficha!)).id : null;
    const passwordHash = await bcrypt.hash(data.password, 10);

    const newUserRes = await query(
      `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, ficha_id, estado, origen)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente', 'registro')
       RETURNING id, rol;`,
      [data.name, data.document, data.email, passwordHash, data.accountType, fichaId]
    );

    return res.status(202).json({
      message: `Solicitud enviada. El Coordinador debe aprobar tu cuenta de ${data.accountType} antes de que puedas ingresar.`,
      solicitud: { id: newUserRes.rows[0].id, rol: newUserRes.rows[0].rol, estado: 'pendiente' },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ user: null, activeSession: false, message: 'Sesión no encontrada' });
    }

    const userRes = await query(`${SELECT_USUARIO} WHERE u.id = $1 LIMIT 1;`, [req.user.id]);
    const user = userRes.rows[0];
    if (!user || user.estado !== 'activo') {
      return res.status(401).json({ user: null, activeSession: false, message: 'Usuario no encontrado o inactivo.' });
    }

    return res.json({ user: usuarioPublico(user), activeSession: true });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/cambiar-clave — body: { actual, nueva }. Obligatorio en el primer ingreso de las
 * cuentas creadas por carga masiva o con la clave restablecida (debe_cambiar_clave).
 */
export const cambiarClave = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = cambiarClaveSchema.parse(req.body ?? {});
    const userRes = await query(`${SELECT_USUARIO} WHERE u.id = $1;`, [req.user!.id]);
    const user = userRes.rows[0];

    if (!user?.password_hash || !(await bcrypt.compare(data.actual, user.password_hash))) {
      return res.status(400).json({ message: 'La contraseña actual no es correcta.' });
    }
    if (data.nueva === user.cedula) {
      return res.status(400).json({ message: 'La nueva contraseña no puede ser tu número de documento.' });
    }

    const passwordHash = await bcrypt.hash(data.nueva, 10);
    await query('UPDATE usuarios SET password_hash = $1, debe_cambiar_clave = false, updated_at = NOW() WHERE id = $2;', [
      passwordHash,
      user.id,
    ]);
    await registrarAuditoria({
      usuario: req.user,
      accion: 'cambiar_clave',
      entidad: 'cuenta',
      entidadId: user.id,
      antes: { debe_cambiar_clave: user.debe_cambiar_clave },
      despues: { debe_cambiar_clave: false },
    });

    return res.json({
      message: 'Contraseña actualizada.',
      user: usuarioPublico({ ...user, debe_cambiar_clave: false }),
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const usersRes = await query(
      `SELECT u.id, u.nombre as name, u.cedula as document, u.email, u.rol as role,
              u.saldo, u.estado, u.created_at, f.codigo_ficha as ficha
       FROM usuarios u
       LEFT JOIN fichas f ON u.ficha_id = f.id
       ORDER BY u.nombre ASC;`
    );

    const formatted = usersRes.rows.map((u) => ({
      id: u.id,
      document: u.document,
      name: u.name,
      role: u.role,
      email: u.email || '',
      ficha: u.ficha || undefined,
      status: u.estado === 'activo' ? 'ACTIVE' : 'INACTIVE',
      created_at: u.created_at,
    }));

    return res.json(formatted);
  } catch (error) {
    next(error);
  }
};
