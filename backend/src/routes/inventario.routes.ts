import { Router } from 'express';
import {
  getMateriales,
  addMaterial,
  getRecetas,
  getKardex,
  getMermas,
  addMerma,
} from '../controllers/inventario.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('encargado'));

router.get('/materiales', getMateriales);
router.post('/materiales', addMaterial);
router.get('/recetas', getRecetas);
router.get('/kardex', getKardex);
router.get('/mermas', getMermas);
router.post('/mermas', addMerma);

export default router;
