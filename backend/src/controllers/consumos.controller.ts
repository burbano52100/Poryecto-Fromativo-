import { Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const getUserConsumos = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const result = await query(
      `SELECT v.id, v.fecha_hora, v.precio_cobrado, v.metodo_pago, v.estado,
              m.nombre as menu_nombre
       FROM ventas v
       JOIN menus_dia m ON v.menu_id = m.id
       WHERE v.usuario_id = $1
       ORDER BY v.fecha_hora DESC;`,
      [userId]
    );

    const formatted = result.rows.map((row) => {
      const dateObj = new Date(row.fecha_hora);
      const dateStr = dateObj.toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      return {
        id: row.id,
        date: dateStr,
        title: row.menu_nombre,
        price: `$${Number(row.precio_cobrado).toLocaleString('es-CO')}`,
        paymentStatus: row.metodo_pago === 'credito' ? ('PENDIENTE' as const) : ('PAGADO' as const),
        status: 'CONSUMED' as const,
      };
    });

    return res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const reservarAlmuerzo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role || 'aprendiz';

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const { menu_id } = req.body;

    let targetMenu: any = null;
    if (menu_id) {
      const specificMenu = await query('SELECT * FROM menus_dia WHERE id = $1;', [menu_id]);
      targetMenu = specificMenu.rows[0];
    } else {
      const activeMenuRes = await query(
        "SELECT * FROM menus_dia WHERE estado = 'activo' ORDER BY fecha DESC LIMIT 1;"
      );
      targetMenu = activeMenuRes.rows[0];
    }

    if (!targetMenu) {
      return res.status(400).json({ message: 'No hay un menú activo disponible para reservar en este momento.' });
    }

    const price = role === 'invitado' ? Number(targetMenu.precio_invitado) : Number(targetMenu.precio_aprendiz);
    const metodoPago = role === 'instructor' ? 'credito' : role === 'aprendiz' ? 'saldo' : 'efectivo';

    const insertVenta = await query(
      `INSERT INTO ventas (usuario_id, menu_id, precio_cobrado, metodo_pago, metodo_verificacion, estado)
       VALUES ($1, $2, $3, $4, 'manual', 'completada')
       RETURNING *;`,
      [userId, targetMenu.id, price, metodoPago]
    );

    await query(
      'UPDATE menus_dia SET cantidad_vendida = cantidad_vendida + 1 WHERE id = $1;',
      [targetMenu.id]
    );

    if (role === 'instructor') {
      const existingDeuda = await query(
        "SELECT id, monto, almuerzos_pendientes FROM deudas WHERE usuario_id = $1 AND estado != 'pagada' LIMIT 1;",
        [userId]
      );

      if (existingDeuda.rows.length > 0) {
        await query(
          `UPDATE deudas
           SET monto = monto + $1,
               almuerzos_pendientes = almuerzos_pendientes + 1,
               updated_at = NOW()
           WHERE id = $2;`,
          [price, existingDeuda.rows[0].id]
        );
      } else {
        await query(
          `INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes, fecha_origen, estado)
           VALUES ($1, $2, 1, CURRENT_DATE, 'pendiente');`,
          [userId, price]
        );
      }
    }

    const dateStr = new Date().toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return res.status(201).json({
      id: insertVenta.rows[0].id,
      date: dateStr,
      title: `${targetMenu.nombre} (Registrado)`,
      price: `$${price.toLocaleString('es-CO')}`,
      paymentStatus: metodoPago === 'credito' ? 'PENDIENTE' : 'PAGADO',
      status: 'RESERVED',
      message: '¡Almuerzo registrado con éxito!',
    });
  } catch (error) {
    next(error);
  }
};
