import { Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const getDeudas = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT d.id, d.monto, d.almuerzos_pendientes, d.fecha_origen, d.estado,
              (CURRENT_DATE - d.fecha_origen)::int as dias_vencidos,
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
      `SELECT COALESCE(SUM(monto), 0)::numeric as saldo_pendiente
       FROM deudas
       WHERE usuario_id = $1 AND estado != 'pagada';`,
      [userId]
    );

    const consumosRes = await query(
      `SELECT COALESCE(SUM(precio_cobrado), 0)::numeric as total_consumido,
              COUNT(*)::int as total_almuerzos
       FROM ventas
       WHERE usuario_id = $1
         AND fecha_hora >= DATE_TRUNC('month', CURRENT_DATE);`,
      [userId]
    );

    const pendingBalance = Number(deudaRes.rows[0]?.saldo_pendiente || 0);
    const totalConsumed = Number(consumosRes.rows[0]?.total_consumido || 0);
    const monthlyLunches = consumosRes.rows[0]?.total_almuerzos || 0;

    return res.json({
      totalConsumed,
      pendingBalance,
      monthlyLunches,
      paymentMethod: 'Efectivo en oficina del comedor',
      paymentFrequency: 'Mensual',
      nextCutoffDate: 'Fin de mes',
    });
  } catch (error) {
    next(error);
  }
};

export const registrarPagoDeuda = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const montoPagado = req.body.monto ? Number(req.body.monto) : null;

    const deudaRes = await query('SELECT * FROM deudas WHERE id = $1;', [id]);
    const deuda = deudaRes.rows[0];

    if (!deuda) {
      return res.status(404).json({ message: 'Deuda no encontrada.' });
    }

    const totalDeuda = Number(deuda.monto);
    const pago = montoPagado !== null && montoPagado > 0 ? Math.min(montoPagado, totalDeuda) : totalDeuda;
    const nuevoMonto = totalDeuda - pago;
    const nuevoEstado = nuevoMonto <= 0 ? 'pagada' : deuda.estado;

    await query(
      'INSERT INTO pagos_deuda (deuda_id, monto_pagado, registrado_por) VALUES ($1, $2, $3);',
      [deuda.id, pago, req.user?.id || null]
    );

    await query(
      `UPDATE deudas
       SET monto = $1,
           almuerzos_pendientes = CASE WHEN $1 <= 0 THEN 0 ELSE almuerzos_pendientes END,
           estado = $2,
           updated_at = NOW()
       WHERE id = $3;`,
      [nuevoMonto, nuevoEstado, deuda.id]
    );

    return res.json({
      message: `Pago de $${pago.toLocaleString('es-CO')} registrado exitosamente.`,
      saldoRestante: nuevoMonto,
      estado: nuevoEstado,
    });
  } catch (error) {
    next(error);
  }
};
