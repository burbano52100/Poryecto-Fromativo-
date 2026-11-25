import { Router } from 'express';
import {
  aprobarComprobante,
  imagenComprobante,
  listarComprobantes,
  rechazarComprobante,
  resumenComprobantes,
} from '../controllers/comprobantes.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

/** Revisión de comprobantes de pago con QR (ADR 027). Solo el encargado del comedor. */
const router = Router();

router.use(authenticateToken, requireRole('encargado'));
router.get('/', listarComprobantes);
router.get('/resumen', resumenComprobantes);
router.get('/:id/imagen', imagenComprobante);
router.post('/:id/aprobar', aprobarComprobante);
router.post('/:id/rechazar', rechazarComprobante);

export default router;
