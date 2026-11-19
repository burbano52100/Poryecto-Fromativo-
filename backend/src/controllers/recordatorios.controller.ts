import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { parseId } from '../utils/validacion.js';
import { smtpConfigurado } from '../services/correo.service.js';
import {
  enviarRecordatorios,
  instructoresConDeuda,
  type ResultadoRecordatorio,
} from '../services/recordatorios.service.js';

const resumen = (resultados: ResultadoRecordatorio[]) => {
  const enviados = resultados.filter((r) => r.estado === 'enviado');
  const omitidos = resultados.filter((r) => r.estado === 'omitido');
  const fallidos = resultados.filter((r) => r.estado === 'fallido');
  const modoPrueba = enviados.some((r) => r.modo_prueba);
  const partes = [
    `${enviados.length} enviado(s)${modoPrueba ? ' en modo prueba (sin SMTP configurado, se imprimieron en la consola del servidor)' : ''}`,
    `${omitidos.length} omitido(s)`,
    `${fallidos.length} fallido(s)`,
  ];
  return {
    message: `Recordatorios: ${partes.join(', ')}.`,
    enviados: enviados.length,
    omitidos: omitidos.length,
    fallidos: fallidos.length,
    modo_prueba: modoPrueba,
    resultados,
  };
};

/** POST /api/deudas/recordatorios/:instructorId — recordatorio individual. */
export const recordatorioIndividual = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instructorId = parseId(req.params.instructorId, 'El identificador del instructor no es válido.');
    const deudas = await instructoresConDeuda([instructorId]);
    if (deudas.length === 0) throw new AppError('Este instructor no tiene deuda pendiente.', 404);
    const resultados = await enviarRecordatorios(deudas, req.user!);
    const [r] = resultados;
    const body = resumen(resultados);
    if (r.estado === 'omitido') return res.status(409).json({ ...body, message: `No se envió el recordatorio a ${r.nombre}: ${r.motivo}` });
    if (r.estado === 'fallido') return res.status(502).json({ ...body, message: `${r.motivo}` });
    return res.json({
      ...body,
      message: `Recordatorio enviado a ${r.nombre}${r.modo_prueba ? ' (modo prueba: se imprimió en la consola del servidor)' : ''}.`,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/deudas/recordatorios — recordatorio masivo a todos los instructores con deuda. */
export const recordatorioMasivo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const deudas = await instructoresConDeuda();
    if (deudas.length === 0) throw new AppError('No hay instructores con deuda pendiente.', 404);
    return res.json(resumen(await enviarRecordatorios(deudas, req.user!)));
  } catch (error) {
    next(error);
  }
};

/** GET /api/deudas/recordatorios?instructor_id= — historial (los 200 más recientes). */
export const historialRecordatorios = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { instructor_id } = z.object({ instructor_id: z.string().uuid('El instructor no es válido.').optional() }).parse(req.query);
    const result = await query(
      `SELECT r.id, r.instructor_id, u.nombre AS instructor, r.canal, r.estado, r.modo_prueba, r.destinatario,
              r.monto::float8 AS monto, r.error, e.nombre AS enviado_por, r.fecha_hora
       FROM recordatorios_deuda r
       JOIN usuarios u ON u.id = r.instructor_id
       LEFT JOIN usuarios e ON e.id = r.enviado_por
       WHERE ($1::uuid IS NULL OR r.instructor_id = $1)
       ORDER BY r.fecha_hora DESC
       LIMIT 200;`,
      [instructor_id ?? null]
    );
    return res.json({
      smtp_configurado: smtpConfigurado(),
      items: result.rows.map((r) => ({ ...r, fecha_hora: new Date(r.fecha_hora).toISOString() })),
    });
  } catch (error) {
    next(error);
  }
};
