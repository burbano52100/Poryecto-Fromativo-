import { Router } from 'express';
import { getGrupos, getMisFichasInstructor } from '../controllers/grupos.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/', requireRole('encargado', 'instructor'), getGrupos);
router.get('/mis-fichas', requireRole('instructor'), getMisFichasInstructor);

export default router;
