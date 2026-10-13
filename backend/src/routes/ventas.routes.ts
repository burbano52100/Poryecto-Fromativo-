import { Router } from 'express';
import { getVentasReport } from '../controllers/ventas.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.get('/', authenticateToken, requireRole('encargado'), getVentasReport);

export default router;
