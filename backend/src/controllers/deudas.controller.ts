import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, getClient } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { parseId } from '../utils/validacion.js';

export const getDeudas = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT d.id, d.monto::float8 as monto, d.almuerzos_pendientes, d.fecha_origen, d.estado,
              ((NOW() AT TIME ZONE 'America/Bogota')::date - d.fecha_origen)::int as dias_vencidos,
              u.nombre as usuario_nombre, u.cedula, u.rol
       FROM deudas d
       JOIN usuarios u ON d.usuario_id = u.id
       WHERE d.estado != 'pagada' AND d.monto > 0
       ORDER BY dias_vencidos DESC;`
    );

    const formatted = result.rows.map((row) => ({
      id: row.id,
      name: row.usuario_nombre,
      type: row.rol.charAt(0).toUpperCase() + row.rol.slice(1),
      document: row.cedula,
      debt: Number(row.monto),
      lunchesCount: row.almuerzos_pendientes,
      daysOverdue: Math.max(0, row.dias_vencidos),
      status: (row.dias_vencidos > 5 ? 'VENCIDA' : 'ACTIVA') as 'VENCIDA' | 'ACTIVA',
    }));

    return res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getMiCuenta = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const deudaRes = await query(
      `SELECT COALESCE(SUM(monto), 0)::float8 as saldo_pendiente
       FROM deudas
       WHERE usuario_id = $1 AND estado != 'pagada';`,
      [userId]
    );

    const consumosRes = await query(
      `SELECT COALESCE(SUM(precio_cobrado), 0)::float8 as total_consumido,
              COUNT(*)::int as total_almuerzos
       FROM ventas
       WHERE usuario_id = $1
         AND estado = 'completada'
         AND fecha_hora AT TIME ZONE 'America/Bogota' >= DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Bogota');`,
      [userId]
    );

    return res.json({
      totalConsumed: consumosRes.rows[0]?.total_consumido ?? 0,
      pendingBalance: deudaRes.rows[0]?.saldo_pendiente ?? 0,
      monthlyLunches: consumosRes.rows[0]?.total_almuerzos ?? 0,
      paymentMethod: 'Efectivo en oficina del comedor',
      paymentFrequency: 'Mensual',
      nextCutoffDate: 'Fin de mes',
    });
  } catch (error) {
    next(error);
  }
};

const pagoSchema = z.object({
  monto: z.coerce
    .number({ message: 'El monto debe ser un número.' })
    .positive('El monto debe ser mayor a 0.')
    .optional(),
});

/**
 * POST /api/deudas/:id/pagar
 * Registra un abono (o el pago total si no se envía monto) y marca como pagadas las ventas
 * pendientes más antiguas del deudor que el pago alcanza a cubrir. Las ventas que siguen
 * pendientes son las más recientes cuyo total cubre el saldo restante.
 */
export const registrarPagoDeuda = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const parsedId = parseId(req.params.id, 'El identificador de la deuda no es válido.');
  const { monto } = pagoSchema.parse(req.body ?? {});

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const deudaRes = await client.query(
      'SELECT id, usuario_id, monto::float8 as monto, estado FROM deudas WHERE id = $1 FOR UPDATE;',
      [parsedId]
    );
    const deuda = deudaRes.rows[0];

    if (!deuda) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Deuda no encontrada.' });
    }
    if (deuda.estado === 'pagada' || deuda.monto <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Esta deuda ya está saldada.' });
    }

    const totalDeuda = deuda.monto;
    const pago = monto !== undefined ? Math.min(monto, totalDeuda) : totalDeuda;
    const nuevoMonto = Math.round((totalDeuda - pago) * 100) / 100;

    await client.query(
      'INSERT INTO pagos_deuda (deuda_id, monto_pagado, registrado_por) VALUES ($1, $2, $3);',
      [deuda.id, pago, req.user?.id || null]
    );

    // Recorre las ventas pendientes de la más reciente a la más antigua: las que hacen falta
    // para cubrir el saldo restante siguen pendientes, el resto queda pagado.
    const ventasRes = await client.query(
      `SELECT id, precio_cobrado::float8 as precio
       FROM ventas
       WHERE usuario_id = $1 AND estado = 'completada' AND estado_pago = 'pendiente'
       ORDER BY fecha_hora DESC
       FOR UPDATE;`,
      [deuda.usuario_id]
    );

    let cubierto = 0;
    const siguenPendientes: string[] = [];
    const quedanPagadas: string[] = [];
    for (const venta of ventasRes.rows) {
      if (cubierto < nuevoMonto) {
        siguenPendientes.push(venta.id);
        cubierto += venta.precio;
      } else {
        quedanPagadas.push(venta.id);
      }
    }

    if (quedanPagadas.length > 0) {
      await client.query("UPDATE ventas SET estado_pago = 'pagado' WHERE id = ANY($1::uuid[]);", [quedanPagadas]);
    }

    // Si la deuda no tiene ventas asociadas (p. ej. datos de seed), se conserva el conteo previo.
    const nuevoEstado = nuevoMonto <= 0 ? 'pagada' : deuda.estado;
    const almuerzosPendientes = nuevoMonto <= 0 ? 0 : ventasRes.rows.length > 0 ? siguenPendientes.length : null;
    await client.query(
      `UPDATE deudas
       SET monto = $1, almuerzos_pendientes = COALESCE($2, almuerzos_pendientes), estado = $3, updated_at = NOW()
       WHERE id = $4;`,
      [nuevoMonto, almuerzosPendientes, nuevoEstado, deuda.id]
    );

    await client.query('COMMIT');

    return res.json({
      message: `Pago de $${pago.toLocaleString('es-CO')} registrado exitosamente.`,
      saldoRestante: nuevoMonto,
      estado: nuevoEstado,
      almuerzosPagados: quedanPagadas.length,
      almuerzosPendientes: siguenPendientes.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};
