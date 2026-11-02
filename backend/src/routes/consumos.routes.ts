import { Router } from 'express';
import { getUserConsumos, getResumenConsumos, reservarAlmuerzo } from '../controllers/consumos.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, getUserConsumos);
router.get('/resumen', authenticateToken, getResumenConsumos);
router.post('/reservar', authenticateToken, reservarAlmuerzo);

export default router;
