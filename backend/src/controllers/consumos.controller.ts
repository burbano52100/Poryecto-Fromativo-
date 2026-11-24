import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, getClient } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { reservasAbiertas, MENSAJE_FUERA_DE_HORARIO, fechaBogota } from '../utils/horario.js';
import { AppError } from '../middleware/error.middleware.js';
import { parseId } from '../utils/validacion.js';
import { withTransaction } from '../services/inventario.service.js';
import { verificarDiaAbierto } from '../services/cierreCaja.service.js';
import { finalizarBeneficiosVencidos } from '../services/beneficios.service.js';
import { descontarPorReceta, revertirDescuento } from '../services/descuentoReceta.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';

const reservaSchema = z.object({
  menu_id: z.string().uuid().nullish(),
  /**
   * Solo para instructores (ADR 026): 'fiado' se suma a su cuenta del mes (Cartera de Deudas);
   * 'contado' se paga en la ventanilla al recoger, como el aprendiz. Sin valor, fiado.
   */
  forma_pago: z.enum(['fiado', 'contado']).nullish(),
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
              v.estado_pago, (v.metodo_pago = 'credito') as fiado,
              m.id as menu_id, m.nombre as menu_nombre,
              TO_CHAR(m.fecha, 'YYYY-MM-DD') as menu_fecha,
              (m.fecha >= (NOW() AT TIME ZONE 'America/Bogota')::date) as vigente,
              (m.fecha = (NOW() AT TIME ZONE 'America/Bogota')::date) as es_hoy,
              c.estrellas, c.comentario
       FROM ventas v
       JOIN menus_dia m ON v.menu_id = m.id
       LEFT JOIN calificaciones_almuerzo c ON c.menu_id = m.id AND c.usuario_id = v.usuario_id
       WHERE v.usuario_id = $1 AND v.estado = 'completada'
       ORDER BY v.fecha_hora DESC;`,
      [userId]
    );

    const formatted = result.rows.map((row) => {
      const estadoPago = row.estado_pago as EstadoPago;
      return {
        id: row.id,
        fecha: new Date(row.fecha_hora).toISOString(),
        menu_id: row.menu_id,
        menu_fecha: row.menu_fecha,
        // Se puede cancelar mientras el menú sea de hoy o futuro y no esté pagada
        cancelable: Boolean(row.vigente) && estadoPago !== 'pagado',
        // Calificación del almuerzo (ADR 022): solo el día del menú
        calificable: Boolean(row.es_hoy),
        calificacion: row.estrellas ? { estrellas: row.estrellas, comentario: row.comentario } : null,
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
        // Almuerzo del instructor cargado a su cuenta del mes (ADR 026)
        fiado: Boolean(row.fiado),
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
  if (req.user?.role === 'coordinador') {
    return res.status(403).json({ message: 'El coordinador no reserva almuerzos desde su panel.' });
  }

  const parsed = reservaSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: 'El identificador del menú no es válido.' });
  }
  const menuId = parsed.data.menu_id ?? null;
  const formaPago = parsed.data.forma_pago ?? 'fiado';

  if (!reservasAbiertas()) {
    return res.status(409).json({ message: MENSAJE_FUERA_DE_HORARIO, fuera_de_horario: true });
  }

  // Los beneficios con la fecha de fin ya cumplida terminan antes de calcular el precio (ADR 019)
  try {
    await withTransaction((tx) => finalizarBeneficiosVencidos(tx));
  } catch (error) {
    return next(error);
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 0. La reserva entra a la caja de hoy: si hoy ya se cerró, no se registra (ADR 021)
    await verificarDiaAbierto(fechaBogota(), client);

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
      const specificMenu = await client.query("SELECT *, TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha_texto FROM menus_dia WHERE id = $1 FOR UPDATE;", [menuId]);
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
        `SELECT *, TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha_texto FROM menus_dia
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
      // El instructor paga su propio precio (ADR 025); en menús sin él, el del aprendiz.
      // Fiado se carga a su cuenta del mes; de contado lo paga en la ventanilla (ADR 026).
      price = Number(targetMenu.precio_instructor ?? targetMenu.precio_aprendiz);
      metodoPago = formaPago === 'contado' ? 'efectivo' : 'credito';
    }
    const esFiado = metodoPago === 'credito';

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

    // 6. Si es un almuerzo fiado (instructor), registrar/acumular la deuda en la misma transacción
    if (esFiado) {
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

    const venta = insertVenta.rows[0];

    // 7. Descuento de inventario por la receta del menú, en la misma transacción (ADR 020)
    await descontarPorReceta(client, {
      menu: {
        id: targetMenu.id,
        nombre: targetMenu.nombre,
        receta_id: targetMenu.receta_id ?? null,
        fecha: targetMenu.fecha_texto,
      },
      fecha: fechaBogota(),
      porciones: 1,
      referenciaTipo: 'venta',
      referenciaId: venta.id,
      concepto: `Almuerzo vendido: reserva de ${user.nombre}${price === 0 ? ' (beneficiario)' : ''}`,
      usuario: req.user,
    });

    await client.query('COMMIT');

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
      // Fiado: se cargó a la cuenta del mes del instructor (ADR 026)
      fiado: esFiado,
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

/**
 * POST /api/consumos/:id/cancelar — el aprendiz o instructor cancela su propia reserva mientras
 * el menú sea de hoy o futuro, en horario de reservas, y si no la ha pagado. Devuelve el cupo,
 * descuenta la deuda del instructor y genera el movimiento inverso en el kardex (ADR 020).
 * Si la caja del día de la reserva está cerrada, responde 409 (ADR 021).
 */
export const cancelarReserva = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador de la reserva no es válido.');
    if (!reservasAbiertas()) {
      return res.status(409).json({ message: MENSAJE_FUERA_DE_HORARIO, fuera_de_horario: true });
    }

    const venta = await withTransaction(async (client) => {
      const ventaRes = await client.query(
        `SELECT v.id, v.usuario_id, v.menu_id, v.precio_cobrado::float8 AS precio, v.estado, v.estado_pago, v.metodo_pago,
                TO_CHAR(v.fecha_hora AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha,
                (m.fecha >= (NOW() AT TIME ZONE 'America/Bogota')::date) AS vigente, m.nombre AS menu, u.rol
         FROM ventas v
         JOIN menus_dia m ON m.id = v.menu_id
         JOIN usuarios u ON u.id = v.usuario_id
         WHERE v.id = $1
         FOR UPDATE OF v;`,
        [id]
      );
      const actual = ventaRes.rows[0];
      if (!actual || actual.usuario_id !== req.user!.id) throw new AppError('Reserva no encontrada.', 404);
      if (actual.estado !== 'completada') throw new AppError('La reserva ya estaba cancelada.', 409);
      if (!actual.vigente) throw new AppError('No puedes cancelar el almuerzo de un día que ya pasó.', 409);
      if (actual.estado_pago === 'pagado') {
        throw new AppError('Esta reserva ya fue pagada: pide al encargado del comedor que la anule.', 409);
      }
      await verificarDiaAbierto(actual.fecha, client);

      await client.query("UPDATE ventas SET estado = 'anulada' WHERE id = $1;", [id]);
      await client.query(
        'UPDATE menus_dia SET cantidad_vendida = GREATEST(cantidad_vendida - 1, 0) WHERE id = $1;',
        [actual.menu_id]
      );
      // Solo un almuerzo fiado está en la deuda; uno de contado no la tocó (ADR 026)
      if (actual.rol === 'instructor' && actual.metodo_pago === 'credito' && actual.precio > 0) {
        await client.query(
          `UPDATE deudas
           SET monto = GREATEST(monto - $1, 0),
               almuerzos_pendientes = GREATEST(almuerzos_pendientes - 1, 0),
               estado = CASE WHEN monto - $1 <= 0 THEN 'pagada'::estado_deuda ELSE estado END,
               updated_at = NOW()
           WHERE id = (SELECT id FROM deudas WHERE usuario_id = $2 AND estado <> 'pagada'
                       ORDER BY created_at DESC LIMIT 1 FOR UPDATE);`,
          [actual.precio, actual.usuario_id]
        );
      }
      await revertirDescuento(client, {
        referenciaTipo: 'venta',
        referenciaId: id,
        concepto: `Reserva cancelada por ${req.user!.name}`,
        usuario: req.user,
      });
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'cancelar',
          entidad: 'venta',
          entidadId: id,
          antes: { estado: 'completada', menu: actual.menu, precio: actual.precio },
          despues: { estado: 'anulada' },
        },
        client
      );
      return actual;
    });

    return res.json({ message: `Cancelaste tu reserva de "${venta.menu}".` });
  } catch (error) {
    next(error);
  }
};
