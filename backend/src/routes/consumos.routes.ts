import express, { Router } from 'express';
import {
  getUserConsumos,
  getResumenConsumos,
  reservarAlmuerzo,
  cancelarReserva,
} from '../controllers/consumos.controller.js';
import { subirComprobante } from '../controllers/comprobantes.controller.js';
import { comprobanteLimiter } from '../middleware/rateLimit.middleware.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.get('/', authenticateToken, getUserConsumos);
router.get('/resumen', authenticateToken, getResumenConsumos);
router.post('/reservar', authenticateToken, reservarAlmuerzo);
router.post('/:id/cancelar', authenticateToken, requireRole('aprendiz', 'instructor'), cancelarReserva);
// Comprobante del pago con QR (ADR 027): el cuerpo es la imagen, no JSON
router.post(
  '/:id/comprobante',
  authenticateToken,
  requireRole('aprendiz', 'instructor'),
  comprobanteLimiter,
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '5mb' }),
  subirComprobante
);

export default router;
