import { Router } from 'express';
import { updatePerfil } from '../controllers/perfil.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.patch('/', updatePerfil);
router.put('/', updatePerfil);

export default router;
