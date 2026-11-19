import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { TIPO_XLSX } from '../utils/excel.js';
import { TIPO_PDF } from '../utils/pdf.js';
import { REPORTES, TIPOS_REPORTE, reporteExcel, reportePdf } from '../services/reportes.service.js';

const tipoSchema = z.enum(TIPOS_REPORTE, { error: 'El reporte solicitado no existe.' });
const formatoSchema = z.enum(['pdf', 'xlsx'], { error: "El formato debe ser 'pdf' o 'xlsx'." });

/**
 * GET /api/reportes/:tipo?formato=pdf|xlsx&...filtros — descarga el reporte con los mismos filtros
 * de la pantalla. 403 si el rol no ve ese módulo.
 */
export const descargarReporte = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tipo = tipoSchema.parse(req.params.tipo);
    const { formato = 'pdf', ...filtros } = req.query as Record<string, string>;
    const formatoValido = formatoSchema.parse(formato);
    const definicion = REPORTES[tipo];
    if (!definicion.roles.includes(req.user!.role)) {
      throw new AppError('Acceso denegado: no tienes permiso para descargar este reporte.', 403);
    }

    const reporte = await definicion.generar(filtros);
    const buffer = formatoValido === 'pdf' ? await reportePdf(reporte) : await reporteExcel(reporte);
    const nombre = `reporte-${tipo}-${reporte.sufijo}.${formatoValido}`.replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', formatoValido === 'pdf' ? TIPO_PDF : TIPO_XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};
