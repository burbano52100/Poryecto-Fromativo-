import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const loginSchema = z.object({
  accountType: z.enum(['aprendiz', 'instructor', 'encargado', 'invitado']),
  document: z.string().min(4, 'El documento debe tener al menos 4 dígitos'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
  ficha: z.string().optional(),
});

const registerSchema = z
  .object({
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    document: z.string().regex(/^\d{6,12}$/, 'El documento debe contener entre 6 y 12 números'),
    accountType: z.enum(['aprendiz', 'instructor', 'encargado', 'invitado']),
    ficha: z.string().optional(),
    email: z.string().email('Ingresa un correo electrónico válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  })
  .refine(
    (data) => {
      if (data.accountType === 'aprendiz') {
        return !!data.ficha && data.ficha.trim().length >= 5;
      }
      return true;
    },
    {
      message: 'El ID de ficha (mínimo 5 caracteres) es obligatorio para aprendices',
      path: ['ficha'],
    }
  );

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const { accountType, document, password, ficha } = parsed;

    const userRes = await query(
      `SELECT u.id, u.nombre, u.cedula, u.email, u.password_hash, u.rol, u.activo, u.saldo,
              f.id as ficha_id, f.codigo_ficha
       FROM usuarios u
       LEFT JOIN fichas f ON u.ficha_id = f.id
       WHERE u.cedula = $1;`,
      [document]
    );

    const user = userRes.rows[0];

    // Generic failure for any invalid credentials or state
    const genericError = () => res.status(401).json({ message: 'Credenciales inválidas' });

    if (!user) return genericError();
    if (!user.activo) return genericError();
    if (user.rol !== accountType) return genericError();
    if (accountType === 'aprendiz' && ficha && user.codigo_ficha && user.codigo_ficha !== ficha) {
      return genericError();
    }
    if (!user.password_hash) return genericError();

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) return genericError();

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET no configurado en el servidor');
    }

    const payload = {
      id: user.id,
      document: user.cedula,
      name: user.nombre,
      role: user.rol,
      email: user.email,
      ficha_id: user.ficha_id,
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

    return res.json({
      token,
      user: {
        id: user.id,
        document: user.cedula,
        name: user.nombre,
        role: user.rol,
        email: user.email || '',
        ficha: user.codigo_ficha || undefined,
        status: user.activo ? 'ACTIVE' : 'INACTIVE',
      },
      message: 'Inicio de sesión exitoso',
    });
  } catch (error) {
    next(error);
  }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    if (data.accountType === 'encargado' || data.accountType === 'instructor') {
      return res.status(403).json({
        message: 'No está permitido auto-registrarse como instructor o encargado. Contacta a la coordinación del comedor escolar.',
      });
    }

    const existingUser = await query(
      'SELECT id, cedula, email FROM usuarios WHERE cedula = $1 OR email = $2 LIMIT 1;',
      [data.document, data.email]
    );

    if (existingUser.rows.length > 0) {
      const match = existingUser.rows[0];
      if (match.cedula === data.document) {
        return res.status(409).json({ message: 'Ya existe un usuario con este número de documento.' });
      }
      if (match.email === data.email) {
        return res.status(409).json({ message: 'Ya existe un usuario con este correo electrónico.' });
      }
    }

    let assignedFichaId: string | null = null;
    let assignedCodigoFicha: string | undefined = undefined;

    if (data.accountType === 'aprendiz' && data.ficha) {
      const fichaRes = await query(
        'SELECT id, codigo_ficha FROM fichas WHERE codigo_ficha = $1 LIMIT 1;',
        [data.ficha.trim()]
      );

      if (fichaRes.rows.length > 0) {
        assignedFichaId = fichaRes.rows[0].id;
        assignedCodigoFicha = fichaRes.rows[0].codigo_ficha;
      } else {
        const newFichaRes = await query(
          `INSERT INTO fichas (codigo_ficha, programa, vocero, jornada, cantidad_estudiantes)
           VALUES ($1, $2, $3, 'mañana', 1)
           RETURNING id, codigo_ficha;`,
          [data.ficha.trim(), 'Programa de Formación General SENA', data.name]
        );
        assignedFichaId = newFichaRes.rows[0].id;
        assignedCodigoFicha = newFichaRes.rows[0].codigo_ficha;
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const newUserRes = await query(
      `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, ficha_id, activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, nombre, cedula, email, rol, activo;`,
      [data.name.trim(), data.document, data.email.trim(), passwordHash, data.accountType, assignedFichaId]
    );

    const newUser = newUserRes.rows[0];

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET no configurado en el servidor');
    }

    const token = jwt.sign(
      {
        id: newUser.id,
        document: newUser.cedula,
        name: newUser.nombre,
        role: newUser.rol,
        email: newUser.email,
        ficha_id: assignedFichaId || undefined,
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        document: newUser.cedula,
        name: newUser.nombre,
        role: newUser.rol,
        email: newUser.email || '',
        ficha: assignedCodigoFicha,
        status: newUser.activo ? 'ACTIVE' : 'INACTIVE',
      },
      message: '¡Registro exitoso! Cuenta creada en la base de datos.',
    });
  } catch (error) {
    next(error);
  }
};

export const facialLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const facialDemoEnabled = process.env.ENABLE_FACIAL_DEMO === 'true';
    const isProd = process.env.NODE_ENV === 'production';
    if (!facialDemoEnabled || isProd) {
      return res.status(403).json({
        message: 'El reconocimiento biométrico facial simulado está desactivado.',
      });
    }

    const { document = '1005678901' } = req.body;

    const userRes = await query(
      `SELECT u.id, u.nombre, u.cedula, u.email, u.rol, u.activo, f.id as ficha_id, f.codigo_ficha
       FROM usuarios u
       LEFT JOIN fichas f ON u.ficha_id = f.id
       WHERE u.cedula = $1 LIMIT 1;`,
      [document]
    );

    const user = userRes.rows[0];
    if (!user) {
      return res.status(404).json({ message: `No se encontró usuario con el documento ${document} para biometría demo.` });
    }

    if (!user.activo) {
      return res.status(403).json({ message: 'Cuenta de usuario inactiva.' });
    }

    const jwtSecret = process.env.JWT_SECRET!;
    const token = jwt.sign(
      {
        id: user.id,
        document: user.cedula,
        name: user.nombre,
        role: user.rol,
        email: user.email,
        ficha_id: user.ficha_id,
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        document: user.cedula,
        name: user.nombre,
        role: user.rol,
        email: user.email || '',
        ficha: user.codigo_ficha || undefined,
        status: user.activo ? 'ACTIVE' : 'INACTIVE',
      },
      message: 'Autenticación biométrica exitosa (Modo Simulación Dev)',
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

    const userRes = await query(
      `SELECT u.id, u.nombre, u.cedula, u.email, u.rol, u.saldo, u.activo, f.id as ficha_id, f.codigo_ficha
       FROM usuarios u
       LEFT JOIN fichas f ON u.ficha_id = f.id
       WHERE u.id = $1 LIMIT 1;`,
      [req.user.id]
    );

    const user = userRes.rows[0];
    if (!user || !user.activo) {
      return res.status(401).json({ user: null, activeSession: false, message: 'Usuario no encontrado o inactivo.' });
    }

    return res.json({
      user: {
        id: user.id,
        document: user.cedula,
        name: user.nombre,
        role: user.rol,
        email: user.email || '',
        ficha: user.codigo_ficha || undefined,
        status: user.activo ? 'ACTIVE' : 'INACTIVE',
      },
      activeSession: true,
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const usersRes = await query(
      `SELECT u.id, u.nombre as name, u.cedula as document, u.email, u.rol as role,
              u.saldo, u.activo, u.created_at, f.codigo_ficha as ficha
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
      status: u.activo ? 'ACTIVE' : 'INACTIVE',
      created_at: u.created_at,
    }));

    return res.json(formatted);
  } catch (error) {
    next(error);
  }
};
