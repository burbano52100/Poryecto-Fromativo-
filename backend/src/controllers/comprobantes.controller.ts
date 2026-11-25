import { createHash } from 'node:crypto';
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { parseId } from '../utils/validacion.js';
import { esFechaValida, fechaBogota } from '../utils/horario.js';
import { withTransaction } from '../services/inventario.service.js';
import { verificarDiaAbierto } from '../services/cierreCaja.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';
import { liberarReservasVencidas, MINUTOS_PARA_PAGAR } from '../services/pagoQr.service.js';
import {
  analizarComprobante,
  decidir,
  leerImagen,
  tipoDeImagen,
  type AnalisisComprobante,
  type Decision,
  type LecturaOcr,
} from '../services/lectorComprobantes.service.js';

const MOTIVO_DUPLICADO = 'Este comprobante ya se usó para pagar otra reserva. Cada pago sirve para un solo almuerzo.';
const ANALISIS_VACIO: AnalisisComprobante = {
  banco: null,
  numero: null,
  valores: [],
  fechas: [],
  hora: null,
  destinatario: false,
};

/**
 * POST /api/consumos/:id/comprobante (aprendiz o instructor, ADR 027)
 * Cuerpo: la imagen del comprobante (image/png, image/jpeg o image/webp, hasta 5 MB).
 * Lee el comprobante con OCR, revisa fecha, hora, valor y que no se haya usado antes, y responde
 * aceptado (la reserva queda pagada), en_revision (la revisa el encargado) o rechazado (puede subir
 * otro mientras no venza el plazo). Responde 200 en los tres casos.
 */
export const subirComprobante = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador de la reserva no es válido.');
    const imagen = req.body;
    if (!Buffer.isBuffer(imagen) || imagen.length === 0) {
      throw new AppError('Sube la captura del comprobante como imagen PNG, JPG o WEBP.', 400);
    }
    const tipo = tipoDeImagen(imagen);
    if (!tipo) throw new AppError('El archivo no es una imagen PNG, JPG o WEBP.', 400);

    await liberarReservasVencidas({ forzar: true });

    const ventaRes = await query(
      `SELECT v.id, v.usuario_id, v.estado, v.estado_pago, v.metodo_pago, v.precio_cobrado::float8 AS precio,
              v.fecha_hora, NOW() AS ahora,
              TO_CHAR((NOW() AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD') AS hoy,
              EXISTS (SELECT 1 FROM comprobantes_pago c WHERE c.venta_id = v.id AND c.estado = 'en_revision') AS en_revision
       FROM ventas v
       WHERE v.id = $1;`,
      [id]
    );
    const venta = ventaRes.rows[0];
    if (!venta || venta.usuario_id !== req.user!.id) throw new AppError('Reserva no encontrada.', 404);
    validarReservaPorPagar(venta);

    const huella = createHash('sha256').update(imagen).digest('hex');

    let lectura: LecturaOcr | null = null;
    try {
      lectura = await leerImagen(imagen);
    } catch (error) {
      console.error('[Comprobantes] No se pudo leer la imagen con OCR:', error);
    }
    const analisis = lectura ? analizarComprobante(lectura.texto, venta.hoy) : ANALISIS_VACIO;
    let decision: Decision = lectura
      ? decidir(analisis, {
          hoy: venta.hoy,
          valorEsperado: Number(venta.precio),
          confianza: lectura.confianza,
          reservaEn: new Date(venta.fecha_hora),
          ahora: new Date(venta.ahora),
        })
      : {
          estado: 'en_revision',
          motivo: 'No se pudo leer la imagen automáticamente. El encargado revisará tu comprobante y tu almuerzo sigue apartado.',
          valor: null,
          fecha: null,
        };

    // Un comprobante sirve para un solo almuerzo, sin importar desde qué cuenta lo suban
    if (await comprobanteYaUsado(huella, analisis)) {
      decision = { ...decision, estado: 'rechazado', motivo: MOTIVO_DUPLICADO };
    }

    const resultado = await withTransaction(async (client) => {
      const actualRes = await client.query(
        `SELECT v.estado, v.estado_pago, v.metodo_pago,
                TO_CHAR(v.fecha_hora AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha,
                EXISTS (SELECT 1 FROM comprobantes_pago c WHERE c.venta_id = v.id AND c.estado = 'en_revision') AS en_revision
         FROM ventas v WHERE v.id = $1 FOR UPDATE;`,
        [id]
      );
      const actual = actualRes.rows[0];
      validarReservaPorPagar(actual);
      if (decision.estado === 'aceptado') await verificarDiaAbierto(actual.fecha, client);

      const guardar = (d: Decision) =>
        client.query<{ id: string }>(
          `INSERT INTO comprobantes_pago (venta_id, usuario_id, huella, banco, numero_comprobante, valor, fecha_pago,
                                          hora_pago, destinatario_ok, confianza, texto_leido, estado, motivo,
                                          imagen, imagen_tipo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id;`,
          [
            id,
            req.user!.id,
            huella,
            analisis.banco,
            analisis.numero,
            d.valor,
            d.fecha,
            analisis.hora,
            analisis.destinatario,
            lectura ? Math.round(lectura.confianza * 100) / 100 : null,
            lectura?.texto.slice(0, 4000) ?? null,
            d.estado,
            d.motivo,
            // La imagen solo se guarda mientras el encargado la revisa
            d.estado === 'en_revision' ? imagen : null,
            d.estado === 'en_revision' ? tipo : null,
          ]
        );

      let comprobanteId: string;
      await client.query('SAVEPOINT comprobante');
      try {
        comprobanteId = (await guardar(decision)).rows[0].id;
      } catch (error: any) {
        // Dos personas subiendo el mismo comprobante a la vez: el índice único decide
        if (error?.code !== '23505') throw error;
        await client.query('ROLLBACK TO SAVEPOINT comprobante');
        decision = { ...decision, estado: 'rechazado', motivo: MOTIVO_DUPLICADO };
        comprobanteId = (await guardar(decision)).rows[0].id;
      }

      if (decision.estado === 'aceptado') {
        await client.query("UPDATE ventas SET estado_pago = 'pagado', vence_en = NULL WHERE id = $1;", [id]);
      } else if (decision.estado === 'en_revision') {
        // Mientras el encargado lo revisa, la porción sigue apartada
        await client.query('UPDATE ventas SET vence_en = NULL WHERE id = $1;', [id]);
      }

      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'subir_comprobante',
          entidad: 'comprobante_pago',
          entidadId: comprobanteId,
          despues: {
            venta_id: id,
            estado: decision.estado,
            banco: analisis.banco,
            numero: analisis.numero,
            valor: decision.valor,
            fecha: decision.fecha,
            hora: analisis.hora,
          },
        },
        client
      );

      const reservaRes = await client.query(
        'SELECT estado_pago, vence_en FROM ventas WHERE id = $1;',
        [id]
      );
      return { comprobanteId, reserva: reservaRes.rows[0] };
    });

    return res.json({
      id: resultado.comprobanteId,
      estado: decision.estado,
      motivo: decision.motivo,
      lectura: {
        banco: analisis.banco,
        valor: decision.valor,
        fecha: decision.fecha,
        hora: analisis.hora,
        numero: analisis.numero,
      },
      reserva: {
        id,
        estado_pago: resultado.reserva.estado_pago,
        vence_en: resultado.reserva.vence_en ? new Date(resultado.reserva.vence_en).toISOString() : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

function validarReservaPorPagar(venta: { estado: string; estado_pago: string; metodo_pago: string; en_revision: boolean }) {
  if (venta.estado !== 'completada') {
    throw new AppError(
      'Esta reserva ya no está activa: se venció el tiempo para pagar o se canceló. Si quedan almuerzos, puedes reservar de nuevo.',
      409
    );
  }
  if (venta.estado_pago !== 'pendiente') throw new AppError('Esta reserva ya está pagada.', 409);
  if (venta.metodo_pago !== 'qr') throw new AppError('Esta reserva no se paga con el código QR.', 409);
  if (venta.en_revision) throw new AppError('Tu comprobante ya está en revisión del encargado.', 409);
}

async function comprobanteYaUsado(huella: string, analisis: AnalisisComprobante): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM comprobantes_pago
     WHERE estado <> 'rechazado'
       AND (huella = $1 OR (banco = $2 AND numero_comprobante = $3))
     LIMIT 1;`,
    [huella, analisis.banco, analisis.numero]
  );
  return res.rows.length > 0;
}

// ---------------------------------------------------------------- Encargado

const listarSchema = z.object({
  estado: z.enum(['en_revision', 'aceptado', 'rechazado', 'todos']).optional(),
  fecha: z.string().optional(),
});

const SELECT_COMPROBANTE = `
  SELECT c.id, c.estado, c.motivo, c.banco, c.numero_comprobante AS numero, c.valor::float8 AS valor,
         TO_CHAR(c.fecha_pago, 'YYYY-MM-DD') AS fecha_pago, c.hora_pago, c.destinatario_ok,
         c.confianza::float8 AS confianza, c.created_at, c.revisado_en, (c.imagen IS NOT NULL) AS tiene_imagen,
         rv.nombre AS revisado_por,
         u.nombre AS persona_nombre, u.cedula AS persona_cedula, u.rol AS persona_rol, f.codigo_ficha AS persona_ficha,
         v.id AS venta_id, v.precio_cobrado::float8 AS venta_precio, v.estado AS venta_estado,
         v.estado_pago AS venta_estado_pago, m.nombre AS menu
  FROM comprobantes_pago c
  JOIN usuarios u ON u.id = c.usuario_id
  LEFT JOIN fichas f ON f.id = u.ficha_id
  JOIN ventas v ON v.id = c.venta_id
  JOIN menus_dia m ON m.id = v.menu_id
  LEFT JOIN usuarios rv ON rv.id = c.revisado_por`;

const aComprobante = (r: any) => ({
  id: r.id,
  estado: r.estado,
  motivo: r.motivo,
  banco: r.banco,
  numero: r.numero,
  valor: r.valor,
  fecha_pago: r.fecha_pago,
  hora_pago: r.hora_pago,
  destinatario_ok: r.destinatario_ok,
  confianza: r.confianza,
  subido_en: new Date(r.created_at).toISOString(),
  revisado_en: r.revisado_en ? new Date(r.revisado_en).toISOString() : null,
  revisado_por: r.revisado_por,
  tiene_imagen: r.tiene_imagen,
  persona: { nombre: r.persona_nombre, cedula: r.persona_cedula, rol: r.persona_rol, ficha: r.persona_ficha },
  reserva: { id: r.venta_id, precio: r.venta_precio, estado: r.venta_estado, estado_pago: r.venta_estado_pago, menu: r.menu },
});

/**
 * GET /api/comprobantes?estado=&fecha= (encargado)
 * Sin estado: los del día (fecha, hoy por defecto). estado=en_revision trae todos los pendientes
 * de revisar, de cualquier día, los más antiguos primero.
 */
export const listarComprobantes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = listarSchema.safeParse(req.query);
    if (!parsed.success) throw new AppError('El filtro de comprobantes no es válido.', 400);
    const estado = parsed.data.estado ?? 'todos';
    const fecha = parsed.data.fecha ?? fechaBogota();
    if (!esFechaValida(fecha)) throw new AppError('La fecha no es válida (usa AAAA-MM-DD).', 400);

    const filas =
      estado === 'en_revision'
        ? await query(`${SELECT_COMPROBANTE} WHERE c.estado = 'en_revision' ORDER BY c.created_at ASC;`)
        : await query(
            `${SELECT_COMPROBANTE}
             WHERE (c.created_at AT TIME ZONE 'America/Bogota')::date = $1::date
               AND ($2 = 'todos' OR c.estado::text = $2)
             ORDER BY c.created_at DESC;`,
            [fecha, estado]
          );
    return res.json(filas.rows.map(aComprobante));
  } catch (error) {
    next(error);
  }
};

/** GET /api/comprobantes/resumen (encargado): cifras de hoy y comprobantes por revisar. */
export const resumenComprobantes = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const r = await query(
      `SELECT COUNT(*) FILTER (WHERE estado = 'aceptado' AND hoy)::int AS aceptados_hoy,
              COALESCE(SUM(valor) FILTER (WHERE estado = 'aceptado' AND hoy), 0)::float8 AS valor_aceptado_hoy,
              COUNT(*) FILTER (WHERE estado = 'rechazado' AND hoy)::int AS rechazados_hoy,
              COUNT(*) FILTER (WHERE estado = 'en_revision')::int AS en_revision
       FROM (SELECT estado, valor,
                    (created_at AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date AS hoy
             FROM comprobantes_pago) c;`
    );
    return res.json(r.rows[0]);
  } catch (error) {
    next(error);
  }
};

/** GET /api/comprobantes/:id/imagen (encargado): la captura de un comprobante en revisión. */
export const imagenComprobante = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del comprobante no es válido.');
    const r = await query('SELECT imagen, imagen_tipo FROM comprobantes_pago WHERE id = $1;', [id]);
    const fila = r.rows[0];
    if (!fila?.imagen) throw new AppError('La imagen de este comprobante ya no está guardada.', 404);
    res.setHeader('Content-Type', fila.imagen_tipo ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(fila.imagen);
  } catch (error) {
    next(error);
  }
};

async function bloquearEnRevision(client: any, id: string) {
  const r = await client.query(
    `SELECT c.id, c.estado, c.venta_id, v.estado AS venta_estado, v.estado_pago,
            TO_CHAR(v.fecha_hora AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha, u.nombre
     FROM comprobantes_pago c
     JOIN ventas v ON v.id = c.venta_id
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.id = $1
     FOR UPDATE OF c, v;`,
    [id]
  );
  const fila = r.rows[0];
  if (!fila) throw new AppError('Comprobante no encontrado.', 404);
  if (fila.estado !== 'en_revision') throw new AppError('Este comprobante ya fue revisado.', 409);
  return fila;
}

/** POST /api/comprobantes/:id/aprobar (encargado): el comprobante es válido y la reserva queda pagada. */
export const aprobarComprobante = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del comprobante no es válido.');
    const nombre = await withTransaction(async (client) => {
      const c = await bloquearEnRevision(client, id);
      if (c.venta_estado !== 'completada') throw new AppError('La reserva de este comprobante ya no está activa.', 409);
      await verificarDiaAbierto(c.fecha, client);
      await client.query(
        `UPDATE comprobantes_pago
         SET estado = 'aceptado', motivo = 'Aprobado por el encargado', imagen = NULL,
             revisado_por = $2, revisado_en = NOW()
         WHERE id = $1;`,
        [id, req.user!.id]
      );
      await client.query("UPDATE ventas SET estado_pago = 'pagado', vence_en = NULL WHERE id = $1;", [c.venta_id]);
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'aprobar',
          entidad: 'comprobante_pago',
          entidadId: id,
          antes: { estado: 'en_revision' },
          despues: { estado: 'aceptado', venta_id: c.venta_id },
        },
        client
      );
      return c.nombre as string;
    });
    return res.json({ message: `Aprobaste el comprobante de ${nombre}: su almuerzo quedó pagado.` });
  } catch (error) {
    next(error);
  }
};

const rechazoSchema = z.object({
  motivo: z
    .string({ error: 'Escribe el motivo del rechazo.' })
    .trim()
    .min(3, 'Escribe el motivo del rechazo (mínimo 3 caracteres).')
    .max(300, 'El motivo no puede superar 300 caracteres.'),
});

/**
 * POST /api/comprobantes/:id/rechazar (encargado) — { motivo }
 * La persona recibe otros 15 minutos para subir un comprobante válido; si no, la reserva vence.
 */
export const rechazarComprobante = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador del comprobante no es válido.');
    const parsed = rechazoSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'El motivo no es válido.', 400);
    const motivo = parsed.data.motivo;

    const nombre = await withTransaction(async (client) => {
      const c = await bloquearEnRevision(client, id);
      await client.query(
        `UPDATE comprobantes_pago
         SET estado = 'rechazado', motivo = $2, imagen = NULL, revisado_por = $3, revisado_en = NOW()
         WHERE id = $1;`,
        [id, `Rechazado por el encargado: ${motivo}`, req.user!.id]
      );
      if (c.venta_estado === 'completada' && c.estado_pago === 'pendiente') {
        await client.query(
          `UPDATE ventas SET vence_en = NOW() + make_interval(mins => $2) WHERE id = $1;`,
          [c.venta_id, MINUTOS_PARA_PAGAR]
        );
      }
      await registrarAuditoria(
        {
          usuario: req.user,
          accion: 'rechazar',
          entidad: 'comprobante_pago',
          entidadId: id,
          antes: { estado: 'en_revision' },
          despues: { estado: 'rechazado', motivo },
        },
        client
      );
      return c.nombre as string;
    });
    return res.json({
      message: `Rechazaste el comprobante de ${nombre}. Tiene ${MINUTOS_PARA_PAGAR} minutos para subir otro.`,
    });
  } catch (error) {
    next(error);
  }
};
