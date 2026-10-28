import { Response, NextFunction } from 'express';
import { query, getClient } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const getUserConsumos = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const result = await query(
      `SELECT v.id, v.fecha_hora, v.precio_cobrado::float8 as precio_cobrado,
              v.metodo_pago, v.estado_pago, v.estado,
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

      const paymentStatus =
        row.estado_pago === 'gratis'
          ? ('GRATIS' as const)
          : row.estado_pago === 'pagado'
          ? ('PAGADO' as const)
          : ('PENDIENTE' as const);

      const price =
        Number(row.precio_cobrado) === 0
          ? '$0'
          : `$${Number(row.precio_cobrado).toLocaleString('es-CO')}`;

      return {
        id: row.id,
        date: dateStr,
        title: row.menu_nombre,
        price,
        paymentStatus,
        estado_pago: row.estado_pago,
        status: 'CONSUMED' as const,
      };
    });

    return res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const reservarAlmuerzo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const client = await getClient();

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const { menu_id } = req.body;

    await client.query('BEGIN');

    // 1. Obtener usuario con rol y estado de beneficiario
    const userRes = await client.query(
      'SELECT id, nombre, rol, es_beneficiario FROM usuarios WHERE id = $1 FOR UPDATE;',
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // 2. Obtener el menú del día
    let targetMenu: any = null;
    if (menu_id) {
      const specificMenu = await client.query('SELECT * FROM menus_dia WHERE id = $1 FOR UPDATE;', [menu_id]);
      targetMenu = specificMenu.rows[0];
    } else {
      const activeMenuRes = await client.query(
        `SELECT * FROM menus_dia
         WHERE estado = 'activo'
         ORDER BY (fecha = (NOW() AT TIME ZONE 'America/Bogota')::date) DESC, fecha DESC, created_at DESC
         LIMIT 1
         FOR UPDATE;`
      );
      targetMenu = activeMenuRes.rows[0];
    }

    if (!targetMenu) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No hay un menú activo disponible para reservar en este momento.' });
    }

    // 3. Descontar cupo de forma atómica
    const cupoRes = await client.query(
      `UPDATE menus_dia
       SET cantidad_vendida = cantidad_vendida + 1
       WHERE id = $1 AND (cantidad_disponible - cantidad_vendida) > 0
       RETURNING id, cantidad_disponible, cantidad_vendida;`,
      [targetMenu.id]
    );

    if (cupoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'El cupo de almuerzos para este menú se encuentra agotado.' });
    }

    // 4. Determinar tarifas y estados según rol y condición de beneficiario
    let price = Number(targetMenu.precio_aprendiz);
    let metodoPago = 'saldo';
    let estadoPago: 'pendiente' | 'pagado' | 'gratis' = 'pendiente';

    if (user.rol === 'aprendiz') {
      if (user.es_beneficiario) {
        price = 0;
        metodoPago = 'cortesia';
        estadoPago = 'gratis';
      } else {
        price = Number(targetMenu.precio_aprendiz);
        metodoPago = 'saldo';
        estadoPago = 'pendiente';
      }
    } else if (user.rol === 'instructor') {
      price = Number(targetMenu.precio_aprendiz);
      metodoPago = 'credito';
      estadoPago = 'pendiente';
    } else if (user.rol === 'invitado') {
      price = Number(targetMenu.precio_invitado);
      metodoPago = 'efectivo';
      estadoPago = 'pagado';
    }

    // 5. Insertar venta garantizando unicidad usuario/menú
    let insertVenta: any;
    try {
      insertVenta = await client.query(
        `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, estado_pago, metodo_verificacion, estado)
         VALUES ($1, $2, NOW(), $3, $4, $5, 'manual', 'completada')
         RETURNING *;`,
        [userId, targetMenu.id, price, metodoPago, estadoPago]
      );
    } catch (insertErr: any) {
      // Capturar violación de índice único (código 23505)
      if (insertErr.code === '23505') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          message: 'Ya tienes una reserva activa para este menú del día.',
          duplicate: true,
        });
      }
      throw insertErr;
    }

    // 6. Si es instructor, registrar/acumular deuda en la misma transacción
    if (user.rol === 'instructor') {
      const existingDeuda = await client.query(
        "SELECT id, monto, almuerzos_pendientes FROM deudas WHERE usuario_id = $1 AND estado != 'pagada' LIMIT 1 FOR UPDATE;",
        [userId]
      );

      if (existingDeuda.rows.length > 0) {
        await client.query(
          `UPDATE deudas
           SET monto = monto + $1,
               almuerzos_pendientes = almuerzos_pendientes + 1,
               updated_at = NOW()
           WHERE id = $2;`,
          [price, existingDeuda.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes, fecha_origen, estado)
           VALUES ($1, $2, 1, (NOW() AT TIME ZONE 'America/Bogota')::date, 'pendiente');`,
          [userId, price]
        );
      }
    }

    await client.query('COMMIT');

    const dateStr = new Date().toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const paymentStatusMap = {
      gratis: 'GRATIS' as const,
      pagado: 'PAGADO' as const,
      pendiente: 'PENDIENTE' as const,
    };

    return res.status(201).json({
      id: insertVenta.rows[0].id,
      date: dateStr,
      title: `${targetMenu.nombre} (Registrado)`,
      price: price === 0 ? '$0' : `$${price.toLocaleString('es-CO')}`,
      paymentStatus: paymentStatusMap[estadoPago],
      estado_pago: estadoPago,
      status: 'RESERVED',
      message:
        price === 0
          ? '¡Almuerzo gratuito de beneficiario reservado con éxito!'
          : '¡Almuerzo registrado con éxito!',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};
