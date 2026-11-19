import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { parseId } from '../utils/validacion.js';
import { TIPO_XLSX } from '../utils/excel.js';
import {
  confirmarCarga,
  leerArchivo,
  plantilla,
  resultadoExcel,
  resumir,
  TIPOS_CARGA,
  validarFilas,
  type DetalleFila,
  type TipoCarga,
} from '../services/cargaMasiva.service.js';

const tipoSchema = z.enum(TIPOS_CARGA, { error: "El tipo de carga debe ser 'instructores' o 'aprendices'." });

/** El frontend envía el archivo como cuerpo binario y su nombre en el encabezado X-Nombre-Archivo. */
const archivoDe = (req: AuthenticatedRequest): { buffer: Buffer; nombre: string } => {
  const encabezado = req.header('x-nombre-archivo');
  if (!encabezado) throw new AppError('Falta el nombre del archivo.', 400);
  let nombre: string;
  try {
    nombre = decodeURIComponent(encabezado);
  } catch {
    throw new AppError('El nombre del archivo no es válido.', 400);
  }
  // Caracteres no permitidos en un nombre de archivo y caracteres de control
  nombre = Array.from(nombre, (c) => (/[\\/:*?"<>|]/.test(c) || c.charCodeAt(0) < 32 ? '_' : c)).join('').slice(0, 200);
  if (!Buffer.isBuffer(req.body)) throw new AppError('Envía el archivo como contenido binario (application/octet-stream).', 400);
  return { buffer: req.body, nombre };
};

const enviarExcel = (res: Response, nombre: string, buffer: Buffer) => {
  res.setHeader('Content-Type', TIPO_XLSX);
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  return res.send(buffer);
};

/** GET /api/coordinador/cargas/plantilla/:tipo */
export const descargarPlantilla = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tipo = tipoSchema.parse(req.params.tipo);
    return enviarExcel(res, `plantilla-${tipo}.xlsx`, await plantilla(tipo));
  } catch (error) {
    next(error);
  }
};

/** POST /api/coordinador/cargas/:tipo/previsualizar — valida el archivo sin crear nada. */
export const previsualizarCarga = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tipo = tipoSchema.parse(req.params.tipo);
    const { buffer, nombre } = archivoDe(req);
    const filas = await validarFilas(tipo, await leerArchivo(tipo, buffer, nombre));
    return res.json({ tipo, archivo: nombre, resumen: resumir(filas), filas });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/coordinador/cargas/:tipo/confirmar — vuelve a validar el mismo archivo y crea las
 * filas válidas. Responde el resumen (creados, omitidos, con error) y el detalle por fila.
 */
export const confirmarCargaMasiva = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tipo = tipoSchema.parse(req.params.tipo);
    const { buffer, nombre } = archivoDe(req);
    const filas = await validarFilas(tipo, await leerArchivo(tipo, buffer, nombre));
    const carga = await confirmarCarga(tipo, nombre, filas, req.user!);
    return res.status(201).json({ tipo, archivo: nombre, ...carga });
  } catch (error) {
    next(error);
  }
};

/** GET /api/coordinador/cargas — últimas 50 cargas. */
export const historialCargas = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT c.id, c.tipo, c.archivo, c.total_filas, c.creados, c.omitidos, c.con_error, c.fecha_hora,
              u.nombre AS coordinador
       FROM cargas_masivas c
       LEFT JOIN usuarios u ON u.id = c.coordinador_id
       ORDER BY c.fecha_hora DESC
       LIMIT 50;`
    );
    return res.json(result.rows.map((c) => ({ ...c, fecha_hora: new Date(c.fecha_hora).toISOString() })));
  } catch (error) {
    next(error);
  }
};

/** GET /api/coordinador/cargas/:id/resultado — Excel con el estado de cada fila. */
export const descargarResultado = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, 'El identificador de la carga no es válido.');
    const result = await query('SELECT tipo, archivo, detalle FROM cargas_masivas WHERE id = $1;', [id]);
    const carga = result.rows[0];
    if (!carga) throw new AppError('Carga masiva no encontrada.', 404);
    const buffer = await resultadoExcel(carga.tipo as TipoCarga, carga.archivo, carga.detalle as DetalleFila[]);
    return enviarExcel(res, `resultado-carga-${carga.tipo}.xlsx`, buffer);
  } catch (error) {
    next(error);
  }
};
