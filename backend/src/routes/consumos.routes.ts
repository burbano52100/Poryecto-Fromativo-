import { Router } from 'express';
import { getUserConsumos, reservarAlmuerzo } from '../controllers/consumos.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticateToken, getUserConsumos);
router.post('/reservar', authenticateToken, reservarAlmuerzo);

export default router;
