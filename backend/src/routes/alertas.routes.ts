import { Router } from 'express';
import { listarAlertas, marcarAlertaLeida, marcarTodasLeidas } from '../controllers/alertas.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('encargado'));

router.get('/', listarAlertas);
router.post('/leer-todas', marcarTodasLeidas);
router.patch('/:id/leida', marcarAlertaLeida);

export default router;
