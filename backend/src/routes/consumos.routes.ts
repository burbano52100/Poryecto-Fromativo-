import { Router } from 'express';
import {
  getUserConsumos,
  getResumenConsumos,
  reservarAlmuerzo,
  cancelarReserva,
} from '../controllers/consumos.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.get('/', authenticateToken, getUserConsumos);
router.get('/resumen', authenticateToken, getResumenConsumos);
router.post('/reservar', authenticateToken, reservarAlmuerzo);
router.post('/:id/cancelar', authenticateToken, requireRole('aprendiz', 'instructor'), cancelarReserva);

export default router;
