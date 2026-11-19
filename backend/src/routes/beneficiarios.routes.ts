import { Router } from 'express';
import {
  getEstudiantes,
  getBeneficiarios,
  getHistorialBeneficiario,
  darDeAlta,
  editarBeneficio,
  activarDesdeEspera,
  finalizar,
} from '../controllers/beneficiarios.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('encargado'));

router.get('/estudiantes', getEstudiantes);
router.get('/historial/:usuarioId', getHistorialBeneficiario);
router.get('/', getBeneficiarios);
router.post('/', darDeAlta);
router.patch('/:id', editarBeneficio);
router.post('/:id/activar', activarDesdeEspera);
router.post('/:id/finalizar', finalizar);

export default router;
