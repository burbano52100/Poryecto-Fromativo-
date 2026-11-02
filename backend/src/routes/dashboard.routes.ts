import { Router } from 'express';
import { getResumenEncargado } from '../controllers/dashboard.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.get('/encargado', authenticateToken, requireRole('encargado'), getResumenEncargado);

export default router;
