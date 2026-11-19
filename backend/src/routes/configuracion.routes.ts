import { Router } from 'express';
import { getConfiguracion, updateConfiguracion } from '../controllers/configuracion.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('encargado'));

router.get('/', getConfiguracion);
router.put('/', updateConfiguracion);

export default router;
