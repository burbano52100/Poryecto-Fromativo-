import { Router } from 'express';
import {
  getTarifas,
  listarAlmuerzosInvitados,
  getResumenAlmuerzosInvitados,
  crearAlmuerzoInvitado,
  editarAlmuerzoInvitado,
  eliminarAlmuerzoInvitado,
} from '../controllers/almuerzosInvitados.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

// Todo el módulo es exclusivo del encargado (ADR 016)
router.use(authenticateToken);
router.use(requireRole('encargado'));

router.get('/tarifas', getTarifas);
router.get('/resumen', getResumenAlmuerzosInvitados);
router.get('/', listarAlmuerzosInvitados);
router.post('/', crearAlmuerzoInvitado);
router.put('/:id', editarAlmuerzoInvitado);
router.delete('/:id', eliminarAlmuerzoInvitado);

export default router;
