import { Router } from 'express';
import {
  getGrupos,
  getMisFichasInstructor,
  getAprendicesDeGrupo,
  marcarPagoVenta,
} from '../controllers/grupos.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/', requireRole('encargado'), getGrupos);
router.get('/mis-fichas', requireRole('instructor'), getMisFichasInstructor);
router.get('/:id/aprendices', requireRole('encargado'), getAprendicesDeGrupo);
router.patch('/ventas/:ventaId/pago', requireRole('encargado'), marcarPagoVenta);

export default router;
