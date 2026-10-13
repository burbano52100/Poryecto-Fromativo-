import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

// 1. CONTROL DE STOCK
export const getMateriales = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT m.id, m.codigo_barras as code, m.nombre as name,
              c.nombre as category, m.unidad_medida as unit,
              TO_CHAR(m.fecha_vencimiento, 'DD/MM/YYYY') as expiry,
              m.stock_actual::int as stock,
              m.stock_minimo::int as stock_minimo,
              m.costo_unitario::numeric as costo
       FROM materiales m
       LEFT JOIN categorias_material c ON m.categoria_id = c.id
       WHERE m.activo = true
       ORDER BY m.nombre ASC;`
    );
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const materialSchema = z.object({
  name: z.string().min(2, 'El nombre del material es obligatorio'),
  code: z.string().optional(),
  category: z.string().default('Granos'),
  unit: z.string().default('Kg'),
  expiry: z.string().optional(),
  stock: z.coerce.number().min(0, 'El stock debe ser positivo'),
});

export const addMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = materialSchema.parse(req.body);
    const code = data.code || String(Math.floor(100000000000 + Math.random() * 900000000000));

    let catId: string | null = null;
    if (data.category) {
      const catRes = await query(
        'INSERT INTO categorias_material (nombre) VALUES ($1) ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id;',
        [data.category.trim()]
      );
      catId = catRes.rows[0].id;
    }

    let parsedExpiry: string | null = null;
    if (data.expiry) {
      if (data.expiry.includes('/')) {
        const parts = data.expiry.split('/');
        if (parts.length === 3) {
          parsedExpiry = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      } else {
        parsedExpiry = data.expiry;
      }
    }

    const insertRes = await query(
      `INSERT INTO materiales (codigo_barras, nombre, categoria_id, unidad_medida, fecha_vencimiento, stock_actual, stock_minimo)
       VALUES ($1, $2, $3, $4, $5, $6, 10)
       RETURNING id, codigo_barras as code, nombre as name, unidad_medida as unit, stock_actual::int as stock;`,
      [code, data.name.trim(), catId, data.unit, parsedExpiry, data.stock]
    );

    await query(
      `INSERT INTO movimientos_kardex (material_id, usuario_id, tipo, concepto, cantidad_entrada, saldo_resultante)
       VALUES ($1, $2, 'entrada', 'Ingreso inicial de material', $3, $3);`,
      [insertRes.rows[0].id, req.user?.id || null, data.stock]
    );

    return res.status(201).json({
      ...insertRes.rows[0],
      category: data.category,
      expiry: data.expiry || '30/12/2026',
    });
  } catch (error) {
    next(error);
  }
};

// 2. RECETAS
export const getRecetas = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recetasRes = await query(
      `SELECT r.id, r.codigo as code, r.nombre as name,
              r.costo_produccion::int as cost, r.precio_venta::int as price
       FROM recetas r
       WHERE r.activa = true
       ORDER BY r.nombre ASC;`
    );

    const recetas = recetasRes.rows;

    for (const r of recetas) {
      const ingRes = await query(
        `SELECT m.nombre as item,
                CONCAT(ri.cantidad, ' ', ri.unidad) as quantity,
                ri.costo::int as cost
         FROM receta_ingredientes ri
         JOIN materiales m ON ri.material_id = m.id
         WHERE ri.receta_id = $1;`,
        [r.id]
      );
      r.ingredients = ingRes.rows;
    }

    return res.json(recetas);
  } catch (error) {
    next(error);
  }
};

// 3. KARDEX
export const getKardex = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const kardexRes = await query(
      `SELECT k.id,
              TO_CHAR(k.fecha_hora, 'DD/MM/YYYY HH12:MI AM') as date,
              m.nombre as material,
              COALESCE(u.nombre, 'Sistema Comedor') as responsible,
              k.concepto,
              CASE WHEN k.cantidad_entrada IS NOT NULL THEN CONCAT('+', k.cantidad_entrada, ' ', m.unidad_medida) ELSE '-' END as entry,
              CASE WHEN k.cantidad_salida IS NOT NULL THEN CONCAT('-', k.cantidad_salida, ' ', m.unidad_medida) ELSE '-' END as exit
       FROM movimientos_kardex k
       JOIN materiales m ON k.material_id = m.id
       LEFT JOIN usuarios u ON k.usuario_id = u.id
       ORDER BY k.fecha_hora DESC
       LIMIT 50;`
    );
    return res.json(kardexRes.rows);
  } catch (error) {
    next(error);
  }
};

// 4. MERMAS
export const getMermas = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const mermasRes = await query(
      `SELECT mer.id,
              TO_CHAR(mer.fecha_hora, 'DD/MM/YYYY HH12:MI AM') as date,
              m.nombre as material,
              CONCAT(mer.cantidad_perdida, ' ', mer.unidad) as quantity,
              mer.razon as reason
       FROM mermas mer
       JOIN materiales m ON mer.material_id = m.id
       ORDER BY mer.fecha_hora DESC
       LIMIT 30;`
    );
    return res.json(mermasRes.rows);
  } catch (error) {
    next(error);
  }
};

const mermaSchema = z.object({
  material: z.string().min(1, 'El material es obligatorio'),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  reason: z.string().min(3, 'La razón es obligatoria'),
});

export const addMerma = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = mermaSchema.parse(req.body);

    const matRes = await query(
      'SELECT id, nombre, unidad_medida, stock_actual FROM materiales WHERE nombre ILIKE $1 OR id::text = $1 LIMIT 1;',
      [data.material.trim()]
    );

    if (matRes.rows.length === 0) {
      return res.status(404).json({ message: `Material '${data.material}' no encontrado.` });
    }

    const material = matRes.rows[0];
    const newStock = Math.max(0, Number(material.stock_actual) - data.quantity);

    const kardexRes = await query(
      `INSERT INTO movimientos_kardex (material_id, usuario_id, tipo, concepto, cantidad_salida, saldo_resultante)
       VALUES ($1, $2, 'merma', $3, $4, $5)
       RETURNING id;`,
      [
        material.id,
        req.user?.id || null,
        `Merma: ${data.reason.trim()}`,
        data.quantity,
        newStock,
      ]
    );

    await query('UPDATE materiales SET stock_actual = $1 WHERE id = $2;', [newStock, material.id]);

    const mermaRes = await query(
      `INSERT INTO mermas (material_id, cantidad_perdida, unidad, razon, registrado_por, movimiento_kardex_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, TO_CHAR(fecha_hora, 'DD/MM/YYYY HH12:MI AM') as date;`,
      [
        material.id,
        data.quantity,
        material.unidad_medida,
        data.reason.trim(),
        req.user?.id || null,
        kardexRes.rows[0].id,
      ]
    );

    return res.status(201).json({
      id: mermaRes.rows[0].id,
      date: mermaRes.rows[0].date,
      material: material.nombre,
      quantity: `${data.quantity} ${material.unidad_medida}`,
      reason: data.reason,
    });
  } catch (error) {
    next(error);
  }
};
