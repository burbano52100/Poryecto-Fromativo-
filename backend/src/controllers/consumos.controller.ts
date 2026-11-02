import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, getClient } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { reservasAbiertas, MENSAJE_FUERA_DE_HORARIO } from '../utils/horario.js';

const reservaSchema = z.object({
  menu_id: z.string().uuid().nullish(),
});

const formatearPrecio = (precio: number) => (precio === 0 ? '$0' : `$${precio.toLocaleString('es-CO')}`);

const paymentStatusMap = {
  gratis: 'GRATIS',
  pagado: 'PAGADO',
  pendiente: 'PENDIENTE',
} as const;

type EstadoPago = keyof typeof paymentStatusMap;

/**
 * GET /api/consumos
 * Historial del usuario autenticado. Una reserva cuenta como RESERVED mientras su menú
 * sea de hoy o de un día futuro (hora de Colombia) y como CONSUMED cuando ya pasó.
 */
export const getUserConsumos = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const result = await query(
      `SELECT v.id, v.fecha_hora, v.precio_cobrado::float8 as precio_cobrado,
              v.estado_pago,
              m.nombre as menu_nombre,
              TO_CHAR(m.fecha, 'YYYY-MM-DD') as menu_fecha,
              (m.fecha >= (NOW() AT TIME ZONE 'America/Bogota')::date) as vigente
       FROM ventas v
       JOIN menus_dia m ON v.menu_id = m.id
       WHERE v.usuario_id = $1 AND v.estado = 'completada'
       ORDER BY v.fecha_hora DESC;`,
      [userId]
    );

    const formatted = result.rows.map((row) => {
      const estadoPago = row.estado_pago as EstadoPago;
      return {
        id: row.id,
        fecha: new Date(row.fecha_hora).toISOString(),
        menu_fecha: row.menu_fecha,
        date: new Date(row.fecha_hora).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'America/Bogota',
        }),
        title: row.menu_nombre,
        precio: Number(row.precio_cobrado),
        price: formatearPrecio(Number(row.precio_cobrado)),
        paymentStatus: paymentStatusMap[estadoPago],
        estado_pago: estadoPago,
        status: row.vigente ? ('RESERVED' as const) : ('CONSUMED' as const),
      };
    });

    return res.json(formatted);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/consumos/resumen
 * Totales del usuario autenticado para las tarjetas del panel (mes en hora de Colombia).
 */
export const getResumenConsumos = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const result = await query(
      `SELECT COUNT(*)::int as total_almuerzos,
              COUNT(*) FILTER (WHERE v.fecha_hora AT TIME ZONE 'America/Bogota'
                                     >= DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Bogota'))::int as almuerzos_mes,
              COALESCE(SUM(v.precio_cobrado) FILTER (WHERE v.fecha_hora AT TIME ZONE 'America/Bogota'
                                     >= DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Bogota')), 0)::float8 as gasto_mes,
              COALESCE(SUM(v.precio_cobrado), 0)::float8 as gasto_total,
              COALESCE(SUM(v.precio_cobrado) FILTER (WHERE v.estado_pago = 'pendiente'), 0)::float8 as pendiente_pago
       FROM ventas v
       WHERE v.usuario_id = $1 AND v.estado = 'completada';`,
      [userId]
    );

    const row = result.rows[0];
    return res.json({
      totalAlmuerzos: row.total_almuerzos,
      almuerzosMes: row.almuerzos_mes,
      gastoMes: row.gasto_mes,
      gastoTotal: row.gasto_total,
      pendientePago: row.pendiente_pago,
    });
  } catch (error) {
    next(error);
  }
};

export const reservarAlmuerzo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'No autenticado.' });
  }

  if (req.user?.role === 'encargado') {
    return res.status(403).json({ message: 'El encargado del comedor no reserva almuerzos desde su panel.' });
  }

  const parsed = reservaSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: 'El identificador del menú no es válido.' });
  }
  const menuId = parsed.data.menu_id ?? null;

  if (!reservasAbiertas()) {
    return res.status(409).json({ message: MENSAJE_FUERA_DE_HORARIO, fuera_de_horario: true });
  }

  const client = await getClient();

  try {
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
    if (menuId) {
      const specificMenu = await client.query('SELECT * FROM menus_dia WHERE id = $1 FOR UPDATE;', [menuId]);
      targetMenu = specificMenu.rows[0];

      if (!targetMenu) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'El menú indicado no existe.' });
      }

      const sinCupo = Number(targetMenu.cantidad_disponible) - Number(targetMenu.cantidad_vendida) <= 0;
      if (targetMenu.estado === 'agotado' || (targetMenu.estado === 'activo' && sinCupo)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'El cupo de almuerzos para este menú se encuentra agotado.' });
      }

      if (targetMenu.estado !== 'activo') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `El menú indicado no está disponible para reservas (estado: ${targetMenu.estado}).`,
        });
      }
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

    // 4. Determinar tarifas y estados según rol y condición de beneficiario.
    //    El precio lo fija siempre el servidor; se ignora cualquier precio enviado por el cliente.
    let price = Number(targetMenu.precio_aprendiz);
    let metodoPago = 'efectivo';
    let estadoPago: EstadoPago = 'pendiente';

    if (user.rol === 'aprendiz' && user.es_beneficiario) {
      price = 0;
      metodoPago = 'cortesia';
      estadoPago = 'gratis';
    } else if (user.rol === 'instructor') {
      metodoPago = 'credito';
    } else if (user.rol === 'invitado') {
      price = Number(targetMenu.precio_invitado);
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

    const venta = insertVenta.rows[0];

    return res.status(201).json({
      id: venta.id,
      fecha: new Date(venta.fecha_hora).toISOString(),
      date: new Date(venta.fecha_hora).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'America/Bogota',
      }),
      title: targetMenu.nombre,
      precio: price,
      price: formatearPrecio(price),
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
