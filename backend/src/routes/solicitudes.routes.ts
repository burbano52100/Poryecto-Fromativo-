import { Router } from 'express';
import { getSolicitudes, aprobarSolicitud, rechazarSolicitud } from '../controllers/solicitudes.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

// Solo el encargado revisa solicitudes de cuenta de instructor y encargado (ADR 015)
const router = Router();

router.use(authenticateToken, requireRole('encargado'));

router.get('/', getSolicitudes);
router.post('/:id/aprobar', aprobarSolicitud);
router.post('/:id/rechazar', rechazarSolicitud);

export default router;
