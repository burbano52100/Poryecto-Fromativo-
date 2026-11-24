import { Router } from 'express';
import {
  cancelarEspecial,
  createAlmuerzoEspecial,
  getAlmuerzosEspeciales,
  getResumenAlmuerzosEspeciales,
  marcarEspecialEntregado,
  marcarEspecialPagado,
} from '../controllers/almuerzosEspeciales.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

/** Almuerzos especiales por contrato (ADR 024). Solo el encargado. */
const router = Router();

router.use(authenticateToken);
router.use(requireRole('encargado'));

router.get('/', getAlmuerzosEspeciales);
router.get('/resumen', getResumenAlmuerzosEspeciales);
router.post('/', createAlmuerzoEspecial);
router.patch('/:id/entregado', marcarEspecialEntregado);
router.patch('/:id/pagado', marcarEspecialPagado);
router.patch('/:id/cancelado', cancelarEspecial);

export default router;
