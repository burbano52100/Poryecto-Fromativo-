import { Router } from 'express';
import {
  crearCalificacion,
  editarCalificacion,
  getCalificacionesEncargado,
  getCalificacionHoy,
} from '../controllers/calificaciones.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/hoy', requireRole('aprendiz', 'instructor'), getCalificacionHoy);
router.post('/', requireRole('aprendiz', 'instructor'), crearCalificacion);
router.put('/:id', requireRole('aprendiz', 'instructor'), editarCalificacion);
router.get('/', requireRole('encargado'), getCalificacionesEncargado);

export default router;
