import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { withTransaction } from '../services/inventario.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';
import {
  CONFIGURACION_POR_DEFECTO,
  LIMITES_CONFIGURACION,
  obtenerConfiguracion,
  type ClaveConfiguracion,
} from '../services/configuracion.service.js';

const CLAVES = Object.keys(CONFIGURACION_POR_DEFECTO) as ClaveConfiguracion[];

/** Cada clave es opcional; si viene, debe ser un entero dentro de su rango. */
const cambiosSchema = z
  .object(
    Object.fromEntries(
      CLAVES.map((clave) => {
        const { min, max, etiqueta } = LIMITES_CONFIGURACION[clave];
        return [
          clave,
          z
            .number({ error: `${etiqueta} debe ser un número.` })
            .int(`${etiqueta} debe ser un número entero.`)
            .min(min, `${etiqueta} debe ser al menos ${min}.`)
            .max(max, `${etiqueta} no puede superar ${max}.`)
            .optional(),
        ];
      })
    ) as Record<ClaveConfiguracion, z.ZodOptional<z.ZodNumber>>
  )
  .strict()
  .refine((cambios) => Object.values(cambios).some((v) => v !== undefined), 'No hay cambios para guardar.');

/** GET /api/configuracion */
export const getConfiguracion = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    return res.json({ valores: await obtenerConfiguracion(), limites: LIMITES_CONFIGURACION });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/configuracion — body: { clave: valor, ... } (solo las que cambian). Queda en la auditoría. */
export const updateConfiguracion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cambios = cambiosSchema.parse(req.body ?? {});
    const valores = await withTransaction(async (client) => {
      const antes = await obtenerConfiguracion(client);
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === undefined) continue;
        await client.query(
          `INSERT INTO configuracion (clave, valor, actualizado_por, updated_at) VALUES ($1, $2::jsonb, $3, NOW())
           ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_por = EXCLUDED.actualizado_por, updated_at = NOW();`,
          [clave, JSON.stringify(valor), req.user!.id]
        );
      }
      const despues = await obtenerConfiguracion(client);
      await registrarAuditoria(
        { usuario: req.user, accion: 'configurar', entidad: 'configuracion', antes, despues },
        client
      );
      return despues;
    });
    return res.json({ valores, limites: LIMITES_CONFIGURACION });
  } catch (error) {
    next(error);
  }
};
