import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const menuSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  fecha: z.string().min(1, 'La fecha es obligatoria'),
  descripcion: z.string().optional(),
  precio_aprendiz: z.coerce.number().min(0, 'El precio debe ser positivo'),
  precio_invitado: z.coerce.number().min(0, 'El precio debe ser positivo'),
  cantidad_disponible: z.coerce.number().min(0, 'La cantidad debe ser positiva'),
  imagen_url: z.string().optional(),
  estado: z.enum(['borrador', 'activo', 'agotado', 'completado']).default('activo'),
});

export const getActiveMenu = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // 1. Buscar menú activo priorizando el menú programado para hoy en zona horaria Bogotá
    const result = await query(
      `SELECT id, fecha, nombre, descripcion,
              precio_aprendiz::float8 as precio_aprendiz,
              precio_invitado::float8 as precio_invitado,
              cantidad_disponible, cantidad_vendida, imagen_url, estado
       FROM menus_dia
       WHERE estado = 'activo'
       ORDER BY (fecha = (NOW() AT TIME ZONE 'America/Bogota')::date) DESC, fecha DESC, created_at DESC
       LIMIT 1;`
    );

    let menu = result.rows[0];

    if (!menu) {
      // Fallback si no hay ningún menú activo cargado aún
      const todayBogotaRes = await query("SELECT (NOW() AT TIME ZONE 'America/Bogota')::date as today;");
      const todayStr = todayBogotaRes.rows[0]?.today || new Date().toISOString().split('T')[0];
      menu = {
        id: 'default_menu',
        fecha: todayStr,
        nombre: 'Menú del Día',
        descripcion: 'Almuerzo completo: Sopa, bandeja con proteína, arroz, ensalada, jugo natural y postre.',
        precio_aprendiz: 5000,
        precio_invitado: 8000,
        cantidad_disponible: 100,
        cantidad_vendida: 0,
        imagen_url: '/cafeteria-bg.jpg',
        estado: 'activo',
      };
    }

    // 2. Determinar precio aplicable según el rol y si es beneficiario en la base de datos
    let precioAplicable = Number(menu.precio_aprendiz);
    let esBeneficiario = false;

    if (req.user?.id) {
      const userRes = await query(
        'SELECT rol, es_beneficiario FROM usuarios WHERE id = $1;',
        [req.user.id]
      );
      const user = userRes.rows[0];

      if (user) {
        if (user.rol === 'aprendiz') {
          esBeneficiario = Boolean(user.es_beneficiario);
          precioAplicable = esBeneficiario ? 0 : Number(menu.precio_aprendiz);
        } else if (user.rol === 'instructor') {
          precioAplicable = Number(menu.precio_aprendiz);
        } else if (user.rol === 'invitado') {
          precioAplicable = Number(menu.precio_invitado);
        }
      }
    }

    return res.json({
      ...menu,
      precio_aprendiz: Number(menu.precio_aprendiz),
      precio_invitado: Number(menu.precio_invitado),
      precio_aplicable: precioAplicable,
      es_beneficiario: esBeneficiario,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllMenus = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT id, fecha, nombre, descripcion, precio_aprendiz, precio_invitado,
              cantidad_disponible, cantidad_vendida, imagen_url, estado, created_at
       FROM menus_dia
       ORDER BY fecha DESC, created_at DESC;`
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
      precio_invitado: raw.precio_invitado ?? raw.priceGuests,
      cantidad_disponible: raw.cantidad_disponible ?? raw.availableQuantity,
      imagen_url: raw.imagen_url || raw.imageUrl || '/cafeteria-bg.jpg',
      estado: raw.estado || (raw.isAvailable === false ? 'borrador' : 'activo'),
    };

    const data = menuSchema.parse(body);

    // Si este nuevo menú está activo, desactivamos otros menús del mismo día
    if (data.estado === 'activo') {
      await query("UPDATE menus_dia SET estado = 'completado' WHERE fecha = $1 AND estado = 'activo';", [data.fecha]);
    }

    const insertRes = await query(
      `INSERT INTO menus_dia (fecha, nombre, descripcion, precio_aprendiz, precio_invitado, cantidad_disponible, imagen_url, estado, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (fecha, nombre) DO UPDATE SET
         descripcion = EXCLUDED.descripcion,
         precio_aprendiz = EXCLUDED.precio_aprendiz,
         precio_invitado = EXCLUDED.precio_invitado,
         cantidad_disponible = EXCLUDED.cantidad_disponible,
         imagen_url = EXCLUDED.imagen_url,
         estado = EXCLUDED.estado
       RETURNING *;`,
      [
        data.fecha,
        data.nombre,
        data.descripcion || '',
        data.precio_aprendiz,
        data.precio_invitado,
        data.cantidad_disponible,
        data.imagen_url,
        data.estado,
        req.user?.id || null,
      ]
    );

    return res.status(201).json(insertRes.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const updateMenuStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['borrador', 'activo', 'agotado', 'completado'].includes(estado)) {
      return res.status(400).json({ message: 'Estado de menú inválido.' });
    }

    const updateRes = await query(
      'UPDATE menus_dia SET estado = $1 WHERE id = $2 RETURNING *;',
      [estado, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ message: 'Menú no encontrado.' });
    }

    return res.json(updateRes.rows[0]);
  } catch (error) {
    next(error);
  }
};
