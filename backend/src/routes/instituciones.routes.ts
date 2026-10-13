import { Router } from 'express';
import {
  getInstituciones,
  createInstitucion,
  getInstructoresList,
} from '../controllers/instituciones.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/', requireRole('encargado'), getInstituciones);
router.post('/', requireRole('encargado'), createInstitucion);
router.get('/instructores', getInstructoresList);

export default router;
