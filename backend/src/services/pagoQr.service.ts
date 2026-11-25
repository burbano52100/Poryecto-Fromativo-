import { withTransaction } from './inventario.service.js';
import { revertirDescuento } from './descuentoReceta.service.js';
import { registrarAuditoria } from './auditoria.service.js';

/**
 * Pago con el código QR (ADR 027): al reservar se aparta la porción y la persona tiene este tiempo
 * para pagar y subir el comprobante. Si no lo hace, la reserva se anula y la porción se libera.
 */
export const MINUTOS_PARA_PAGAR = 15;

const INTERVALO_MINIMO_MS = 20_000;
let ultimaRevision = 0;

/**
 * Anula las reservas con QR cuyo plazo para subir el comprobante ya pasó: devuelve la porción al
 * menú y los ingredientes al inventario. Las reservas en revisión del encargado no vencen.
 * Sin `forzar`, corre como mucho una vez cada 20 s (se llama desde consultas frecuentes).
 */
export async function liberarReservasVencidas(opciones: { forzar?: boolean } = {}): Promise<number> {
  const ahora = Date.now();
  if (!opciones.forzar && ahora - ultimaRevision < INTERVALO_MINIMO_MS) return 0;
  ultimaRevision = ahora;

  return withTransaction(async (client) => {
    const vencidas = await client.query<{ id: string; menu_id: string; nombre: string }>(
      `SELECT v.id, v.menu_id, u.nombre
       FROM ventas v
       JOIN usuarios u ON u.id = v.usuario_id
       WHERE v.metodo_pago = 'qr' AND v.estado = 'completada' AND v.estado_pago = 'pendiente'
         AND v.vence_en IS NOT NULL AND v.vence_en < NOW()
       FOR UPDATE OF v SKIP LOCKED;`
    );
    for (const venta of vencidas.rows) {
      await client.query("UPDATE ventas SET estado = 'anulada' WHERE id = $1;", [venta.id]);
      await client.query('UPDATE menus_dia SET cantidad_vendida = GREATEST(cantidad_vendida - 1, 0) WHERE id = $1;', [
        venta.menu_id,
      ]);
      await revertirDescuento(client, {
        referenciaTipo: 'venta',
        referenciaId: venta.id,
        concepto: `Reserva vencida de ${venta.nombre}: no subió el comprobante a tiempo`,
        usuario: null,
      });
      await registrarAuditoria(
        {
          usuario: null,
          accion: 'vencer',
          entidad: 'venta',
          entidadId: venta.id,
          antes: { estado: 'completada' },
          despues: { estado: 'anulada', motivo: `Sin comprobante de pago en ${MINUTOS_PARA_PAGAR} minutos` },
        },
        client
      );
    }
    return vencidas.rows.length;
  });
}
