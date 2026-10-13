import { Router } from 'express';
import {
  getVisitas,
  getVisitasKPI,
  createVisita,
} from '../controllers/visitas.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('encargado'));

router.get('/', getVisitas);
router.get('/kpi', getVisitasKPI);
router.post('/', createVisita);

export default router;
