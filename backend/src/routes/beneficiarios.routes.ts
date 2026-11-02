import { Router } from 'express';
import {
  getEstudiantes,
  getBeneficiarios,
  toggleBeneficiario,
} from '../controllers/beneficiarios.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('encargado'));

router.get('/estudiantes', getEstudiantes);
router.get('/', getBeneficiarios);
router.patch('/:usuarioId', toggleBeneficiario);

export default router;
