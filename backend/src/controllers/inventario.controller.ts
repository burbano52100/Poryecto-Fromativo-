import { Response, NextFunction } from 'express';
import { z } from 'zod';
import pg from 'pg';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  DECIMALES_INGREDIENTE,
  DECIMALES_STOCK,
  ESTADO_MATERIAL_SQL,
  recalcularReceta,
  recalcularRecetasDeMaterial,
  registrarMerma,
  registrarMovimiento,
  withTransaction,
} from '../services/inventario.service.js';

// ---------------------------------------------------------------------
// Validaciones comunes
// ---------------------------------------------------------------------

const tieneMaxDecimales = (decimales: number) => (valor: number) => {
  const escalado = valor * 10 ** decimales;
  return Math.abs(escalado - Math.round(escalado)) < 1e-9;
};

const cantidadSchema = (decimales: number) =>
  z.coerce
    .number({ message: 'La cantidad debe ser un número.' })
    .positive('La cantidad debe ser mayor a 0.')
    .refine(tieneMaxDecimales(decimales), `La cantidad admite máximo ${decimales} decimales.`);

const montoSchema = z.coerce
  .number({ message: 'El valor debe ser un número.' })
  .min(0, 'El valor no puede ser negativo.')
  .refine(tieneMaxDecimales(2), 'El valor admite máximo 2 decimales.');

const uuidSchema = z.string().uuid('El identificador no es válido.');

/** Acepta YYYY-MM-DD o DD/MM/YYYY y devuelve YYYY-MM-DD, o null si viene vacío. */
const fechaSchema = z
  .string()
  .trim()
  .transform((valor, ctx) => {
    if (valor === '') return null;
    let iso = valor;
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
    if (dmy) iso = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    const fecha = new Date(`${iso}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== iso) {
      ctx.addIssue({ code: 'custom', message: 'La fecha debe tener formato AAAA-MM-DD o DD/MM/AAAA.' });
      return z.NEVER;
    }
    return iso;
  });

const parseId = (id: unknown): string => {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) throw new AppError('El identificador no es válido.', 400);
  return parsed.data;
};

const obtenerCategoriaId = async (db: pg.PoolClient, categoria: string | undefined): Promise<string | null> => {
  if (!categoria || !categoria.trim()) return null;
  const catRes = await db.query(
    'INSERT INTO categorias_material (nombre) VALUES ($1) ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id;',
    [categoria.trim()]
  );
  return catRes.rows[0].id;
};

const MATERIAL_SELECT = `
  SELECT m.id, m.codigo_barras AS code, m.nombre AS name,
         c.nombre AS category, m.unidad_medida AS unit,
         TO_CHAR(m.fecha_vencimiento, 'DD/MM/YYYY') AS expiry,
         TO_CHAR(m.fecha_vencimiento, 'YYYY-MM-DD') AS expiry_iso,
         m.stock_actual::float8 AS stock,
         m.stock_minimo::float8 AS stock_minimo,
         m.costo_unitario::float8 AS costo,
         ${ESTADO_MATERIAL_SQL} AS estado
  FROM materiales m
  LEFT JOIN categorias_material c ON m.categoria_id = c.id`;

const obtenerMaterial = async (db: pg.PoolClient, id: string) => {
  const res = await db.query(`${MATERIAL_SELECT} WHERE m.id = $1;`, [id]);
  return res.rows[0];
};

// ---------------------------------------------------------------------
// 1. CONTROL DE STOCK
// ---------------------------------------------------------------------

export const getMateriales = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(`${MATERIAL_SELECT} WHERE m.activo = true ORDER BY m.nombre ASC;`);
    return res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const materialSchema = z.object({
  name: z.string().trim().min(2, 'El nombre del material es obligatorio (mínimo 2 caracteres).'),
  code: z.string().trim().optional(),
  category: z.string().default('Granos'),
  unit: z.string().trim().min(1, 'La unidad de medida es obligatoria.').default('Kg'),
  expiry: fechaSchema.optional(),
  stock: z.coerce
    .number({ message: 'El stock debe ser un número.' })
    .min(0, 'El stock inicial no puede ser negativo.')
    .refine(tieneMaxDecimales(DECIMALES_STOCK), `El stock admite máximo ${DECIMALES_STOCK} decimales.`),
  stock_minimo: montoSchema.default(10),
  costo_unitario: montoSchema.default(0),
});

export const addMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = materialSchema.parse(req.body);
    const code = data.code || String(Math.floor(100000000000 + Math.random() * 900000000000));

    const material = await withTransaction(async (client) => {
      const catId = await obtenerCategoriaId(client, data.category);
      const insertRes = await client.query(
        `INSERT INTO materiales (codigo_barras, nombre, categoria_id, unidad_medida, fecha_vencimiento, stock_actual, stock_minimo, costo_unitario)
         VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
         RETURNING id;`,
        [code, data.name, catId, data.unit, data.expiry ?? null, data.stock_minimo, data.costo_unitario]
      );
      const id = insertRes.rows[0].id;

      await registrarMovimiento(client, {
        materialId: id,
        tipo: 'entrada',
        cantidad: data.stock,
        concepto: 'Ingreso inicial de material',
        usuarioId: req.user?.id || null,
      });

      return obtenerMaterial(client, id);
    });

    return res.status(201).json(material);
  } catch (error) {
    next(error);
  }
};

const materialUpdateSchema = z
  .object({
    name: z.string().trim().min(2, 'El nombre del material debe tener al menos 2 caracteres.').optional(),
    code: z.string().trim().min(1, 'El código de barras no puede quedar vacío.').optional(),
    category: z.string().trim().optional(),
    unit: z.string().trim().min(1, 'La unidad de medida no puede quedar vacía.').optional(),
    expiry: fechaSchema.nullable().optional(),
    stock_minimo: montoSchema.optional(),
    costo_unitario: montoSchema.optional(),
  })
  .strict();

export const updateMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);
    if (req.body && typeof req.body === 'object' && 'stock' in req.body) {
      throw new AppError('El stock solo se modifica con entradas, salidas o mermas.', 400);
    }
    const parsed = materialUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const desconocido = parsed.error.issues.find((i) => i.code === 'unrecognized_keys');
      if (desconocido) throw new AppError('La solicitud incluye campos que no se pueden editar.', 400);
      throw parsed.error;
    }
    const data = parsed.data;

    const material = await withTransaction(async (client) => {
      const actualRes = await client.query(
        'SELECT id, costo_unitario::float8 AS costo, unidad_medida FROM materiales WHERE id = $1 AND activo = true FOR UPDATE;',
        [id]
      );
      const actual = actualRes.rows[0];
      if (!actual) throw new AppError('Material no encontrado.', 404);

      const sets: string[] = [];
      const params: unknown[] = [];
      const set = (columna: string, valor: unknown) => {
        params.push(valor);
        sets.push(`${columna} = $${params.length}`);
      };

      if (data.name !== undefined) set('nombre', data.name);
      if (data.code !== undefined) set('codigo_barras', data.code);
      if (data.category !== undefined) set('categoria_id', await obtenerCategoriaId(client, data.category));
      if (data.unit !== undefined) set('unidad_medida', data.unit);
      if (data.expiry !== undefined) set('fecha_vencimiento', data.expiry);
      if (data.stock_minimo !== undefined) set('stock_minimo', data.stock_minimo);
      if (data.costo_unitario !== undefined) set('costo_unitario', data.costo_unitario);

      if (sets.length > 0) {
        params.push(id);
        await client.query(`UPDATE materiales SET ${sets.join(', ')} WHERE id = $${params.length};`, params);
      }

      const cambioCosto = data.costo_unitario !== undefined && data.costo_unitario !== actual.costo;
      const cambioUnidad = data.unit !== undefined && data.unit !== actual.unidad_medida;
      if (cambioCosto || cambioUnidad) {
        await recalcularRecetasDeMaterial(client, id);
      }

      return obtenerMaterial(client, id);
    });

    return res.json(material);
  } catch (error) {
    next(error);
  }
};

export const deleteMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);

    const resultado = await withTransaction(async (client) => {
      const matRes = await client.query(
        'SELECT id, nombre FROM materiales WHERE id = $1 AND activo = true FOR UPDATE;',
        [id]
      );
      const material = matRes.rows[0];
      if (!material) throw new AppError('Material no encontrado.', 404);

      const recetasRes = await client.query(
        `SELECT r.nombre FROM receta_ingredientes ri
         JOIN recetas r ON r.id = ri.receta_id
         WHERE ri.material_id = $1 AND r.activa = true
         ORDER BY r.nombre;`,
        [id]
      );
      if (recetasRes.rows.length > 0) {
        const nombres = recetasRes.rows.map((r) => r.nombre).join(', ');
        throw new AppError(`No se puede eliminar ${material.nombre}: lo usan estas recetas activas: ${nombres}.`, 409);
      }

      // Borrado lógico: un DELETE real borraría en cascada su historial del kardex
      await client.query('UPDATE materiales SET activo = false WHERE id = $1;', [id]);
      return material;
    });

    return res.json({ message: `Material ${resultado.nombre} eliminado.`, id: resultado.id });
  } catch (error) {
    next(error);
  }
};

const entradaSchema = z.object({
  cantidad: cantidadSchema(DECIMALES_STOCK),
  concepto: z.string().trim().optional(),
  costo_unitario: montoSchema.optional(),
});

export const registrarEntrada = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);
    const data = entradaSchema.parse(req.body);

    const resultado = await withTransaction(async (client) => {
      const mov = await registrarMovimiento(client, {
        materialId: id,
        tipo: 'entrada',
        cantidad: data.cantidad,
        concepto: data.concepto || 'Entrada de stock',
        usuarioId: req.user?.id || null,
      });

      if (data.costo_unitario !== undefined) {
        const costoRes = await client.query(
          `UPDATE materiales SET costo_unitario = $1
           WHERE id = $2 AND costo_unitario IS DISTINCT FROM $1::numeric
           RETURNING id;`,
          [data.costo_unitario, id]
        );
        if (costoRes.rows.length > 0) {
          await recalcularRecetasDeMaterial(client, id);
        }
      }

      return { movimiento_id: mov.movimientoId, material: await obtenerMaterial(client, id) };
    });

    return res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

const salidaSchema = z.object({
  cantidad: cantidadSchema(DECIMALES_STOCK),
  concepto: z.string().trim().min(3, 'El concepto de la salida es obligatorio (mínimo 3 caracteres).'),
});

export const registrarSalida = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);
    const data = salidaSchema.parse(req.body);

    const resultado = await withTransaction(async (client) => {
      const mov = await registrarMovimiento(client, {
        materialId: id,
        tipo: 'salida',
        cantidad: data.cantidad,
        concepto: data.concepto,
        usuarioId: req.user?.id || null,
      });
      return { movimiento_id: mov.movimientoId, material: await obtenerMaterial(client, id) };
    });

    return res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------
// 2. RECETAS
// ---------------------------------------------------------------------

export const getRecetas = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recetasRes = await query(
      `SELECT r.id, r.codigo AS code, r.nombre AS name,
              r.costo_produccion::float8 AS cost,
              r.precio_venta::float8 AS price,
              (r.precio_venta - r.costo_produccion)::float8 AS margen,
              CASE WHEN r.precio_venta > 0
                   THEN ROUND((r.precio_venta - r.costo_produccion) / r.precio_venta * 100, 1)::float8
                   ELSE NULL END AS margen_pct,
              COALESCE(
                json_agg(
                  json_build_object(
                    'material_id', m.id,
                    'item', m.nombre,
                    'cantidad', ri.cantidad::float8,
                    'unidad', ri.unidad,
                    'quantity', CONCAT(ri.cantidad::float8, ' ', ri.unidad),
                    'cost', ri.costo::float8
                  ) ORDER BY m.nombre
                ) FILTER (WHERE ri.id IS NOT NULL),
                '[]'
              ) AS ingredients
       FROM recetas r
       LEFT JOIN receta_ingredientes ri ON ri.receta_id = r.id
       LEFT JOIN materiales m ON m.id = ri.material_id
       WHERE r.activa = true
       GROUP BY r.id
       ORDER BY r.nombre ASC;`
    );

    return res.json(recetasRes.rows);
  } catch (error) {
    next(error);
  }
};

const recetaSchema = z.object({
  name: z.string().trim().min(2, 'El nombre de la receta es obligatorio (mínimo 2 caracteres).'),
  code: z.string().trim().min(1).optional(),
  price: montoSchema,
  ingredients: z
    .array(
      z.object({
        material_id: uuidSchema,
        cantidad: cantidadSchema(DECIMALES_INGREDIENTE),
      })
    )
    .min(1, 'La receta debe tener al menos un ingrediente.')
    .refine(
      (items) => new Set(items.map((i) => i.material_id)).size === items.length,
      'Un material no puede repetirse en la misma receta.'
    ),
});

const guardarIngredientes = async (
  client: pg.PoolClient,
  recetaId: string,
  ingredientes: z.infer<typeof recetaSchema>['ingredients']
) => {
  const ids = ingredientes.map((i) => i.material_id);
  const matRes = await client.query(
    'SELECT id FROM materiales WHERE id = ANY($1::uuid[]) AND activo = true;',
    [ids]
  );
  if (matRes.rows.length !== ids.length) {
    throw new AppError('Uno o más ingredientes hacen referencia a materiales que no existen o están eliminados.', 404);
  }

  await client.query('DELETE FROM receta_ingredientes WHERE receta_id = $1;', [recetaId]);
  for (const ing of ingredientes) {
    // El costo y la unidad se calculan desde el material en recalcularReceta
    await client.query(
      `INSERT INTO receta_ingredientes (receta_id, material_id, cantidad, unidad, costo)
       VALUES ($1, $2, $3, '', 0);`,
      [recetaId, ing.material_id, ing.cantidad]
    );
  }
  await recalcularReceta(client, recetaId);
};

const obtenerReceta = async (client: pg.PoolClient, id: string) => {
  const res = await client.query(
    `SELECT id, codigo AS code, nombre AS name, costo_produccion::float8 AS cost, precio_venta::float8 AS price,
            (precio_venta - costo_produccion)::float8 AS margen
     FROM recetas WHERE id = $1;`,
    [id]
  );
  return res.rows[0];
};

export const createReceta = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = recetaSchema.parse(req.body);

    const receta = await withTransaction(async (client) => {
      let code = data.code;
      if (!code) {
        const seqRes = await client.query(
          `SELECT COALESCE(MAX(SUBSTRING(codigo FROM '^REC-(\\d+)$')::int), 0) + 1 AS siguiente FROM recetas;`
        );
        code = `REC-${String(seqRes.rows[0].siguiente).padStart(3, '0')}`;
      }

      const insertRes = await client.query(
        `INSERT INTO recetas (codigo, nombre, precio_venta, costo_produccion, activa)
         VALUES ($1, $2, $3, 0, true) RETURNING id;`,
        [code, data.name, data.price]
      );
      const id = insertRes.rows[0].id;
      await guardarIngredientes(client, id, data.ingredients);
      return obtenerReceta(client, id);
    });

    return res.status(201).json(receta);
  } catch (error) {
    next(error);
  }
};

export const updateReceta = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);
    const data = recetaSchema.parse(req.body);

    const receta = await withTransaction(async (client) => {
      const existe = await client.query('SELECT id FROM recetas WHERE id = $1 AND activa = true FOR UPDATE;', [id]);
      if (existe.rows.length === 0) throw new AppError('Receta no encontrada.', 404);

      await client.query(
        `UPDATE recetas SET nombre = $1, precio_venta = $2, codigo = COALESCE($3, codigo) WHERE id = $4;`,
        [data.name, data.price, data.code ?? null, id]
      );
      await guardarIngredientes(client, id, data.ingredients);
      return obtenerReceta(client, id);
    });

    return res.json(receta);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------
// 3. KARDEX
// ---------------------------------------------------------------------

const KARDEX_LIMIT_DEFAULT = 50;
const KARDEX_LIMIT_MAX = 200;

const kardexQuerySchema = z.object({
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
  material_id: uuidSchema.optional(),
  tipo: z
    .enum(['entrada', 'salida', 'ajuste', 'merma'], { message: 'El tipo debe ser entrada, salida, ajuste o merma.' })
    .optional(),
  limit: z.coerce.number().int('El límite debe ser un entero.').min(1, 'El límite mínimo es 1.').default(KARDEX_LIMIT_DEFAULT),
  offset: z.coerce.number().int('El desplazamiento debe ser un entero.').min(0, 'El desplazamiento no puede ser negativo.').default(0),
});

export const getKardex = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filtros = kardexQuerySchema.parse(req.query);
    const limit = Math.min(filtros.limit, KARDEX_LIMIT_MAX);

    const condiciones: string[] = [];
    const params: unknown[] = [];
    const agregar = (sql: string, valor: unknown) => {
      params.push(valor);
      condiciones.push(sql.replace('?', `$${params.length}`));
    };

    // Los días se interpretan en America/Bogota; "hasta" incluye todo ese día
    if (filtros.desde) agregar(`k.fecha_hora >= (?::date)::timestamp AT TIME ZONE 'America/Bogota'`, filtros.desde);
    if (filtros.hasta) agregar(`k.fecha_hora < (?::date + 1)::timestamp AT TIME ZONE 'America/Bogota'`, filtros.hasta);
    if (filtros.material_id) agregar('k.material_id = ?', filtros.material_id);
    if (filtros.tipo) agregar('k.tipo = ?', filtros.tipo);

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const totalRes = await query(`SELECT COUNT(*)::int AS total FROM movimientos_kardex k ${where};`, params);

    const kardexRes = await query(
      `SELECT k.id,
              TO_CHAR(k.fecha_hora AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH12:MI AM') AS date,
              k.fecha_hora AS fecha_iso,
              k.material_id,
              m.nombre AS material,
              m.unidad_medida AS unidad,
              COALESCE(u.nombre, 'Sistema Comedor') AS responsible,
              k.tipo,
              k.concepto,
              k.cantidad_entrada::float8 AS cantidad_entrada,
              k.cantidad_salida::float8 AS cantidad_salida,
              k.saldo_resultante::float8 AS saldo,
              CASE WHEN k.cantidad_entrada IS NOT NULL
                   THEN CONCAT('+', k.cantidad_entrada::float8, ' ', m.unidad_medida) ELSE '-' END AS entry,
              CASE WHEN k.cantidad_salida IS NOT NULL
                   THEN CONCAT('-', k.cantidad_salida::float8, ' ', m.unidad_medida) ELSE '-' END AS exit
       FROM movimientos_kardex k
       JOIN materiales m ON k.material_id = m.id
       LEFT JOIN usuarios u ON k.usuario_id = u.id
       ${where}
       ORDER BY k.fecha_hora DESC, k.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2};`,
      [...params, limit, filtros.offset]
    );

    return res.json({
      items: kardexRes.rows,
      total: totalRes.rows[0].total,
      limit,
      offset: filtros.offset,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------
// 4. MERMAS
// ---------------------------------------------------------------------

export const getMermas = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const mermasRes = await query(
      `SELECT mer.id,
              TO_CHAR(mer.fecha_hora AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH12:MI AM') AS date,
              m.id AS material_id,
              m.nombre AS material,
              mer.cantidad_perdida::float8 AS cantidad,
              mer.unidad,
              CONCAT(mer.cantidad_perdida::float8, ' ', mer.unidad) AS quantity,
              mer.razon AS reason,
              mer.movimiento_kardex_id
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

const mermaSchema = z
  .object({
    material_id: uuidSchema.optional(),
    material: z.string().trim().min(1).optional(),
    quantity: cantidadSchema(DECIMALES_STOCK),
    reason: z.string().trim().min(3, 'La razón de la merma es obligatoria (mínimo 3 caracteres).'),
  })
  .refine((d) => d.material_id || d.material, {
    message: 'Debes indicar el material (material_id o nombre).',
    path: ['material_id'],
  });

export const addMerma = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = mermaSchema.parse(req.body);

    const resultado = await withTransaction(async (client) => {
      let materialId = data.material_id;
      if (!materialId) {
        // Solo coincidencia exacta por nombre, nunca parcial
        const matRes = await client.query(
          'SELECT id FROM materiales WHERE nombre = $1 AND activo = true LIMIT 1;',
          [data.material]
        );
        if (matRes.rows.length === 0) {
          throw new AppError(`Material '${data.material}' no encontrado.`, 404);
        }
        materialId = matRes.rows[0].id as string;
      }

      return registrarMerma(client, {
        materialId,
        cantidad: data.quantity,
        razon: data.reason,
        usuarioId: req.user?.id || null,
      });
    });

    return res.status(201).json({
      id: resultado.id,
      date: resultado.date,
      material_id: resultado.movimiento.materialId,
      material: resultado.movimiento.nombre,
      cantidad: data.quantity,
      quantity: `${data.quantity} ${resultado.movimiento.unidad}`,
      reason: data.reason,
      movimiento_kardex_id: resultado.movimiento.movimientoId,
      stock_resultante: resultado.movimiento.saldo,
    });
  } catch (error) {
    next(error);
  }
};
