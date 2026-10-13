import { Router } from 'express';
import {
  getSugerencias,
  createSugerencia,
  responderSugerencia,
} from '../controllers/sugerencias.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getSugerencias);
router.post('/', createSugerencia);
router.patch('/:id/responder', requireRole('encargado'), responderSugerencia);

export default router;
