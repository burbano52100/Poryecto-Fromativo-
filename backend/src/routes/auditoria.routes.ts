import { Router } from 'express';
import { listarAuditoria, opcionesAuditoria } from '../controllers/auditoria.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

// El encargado ve toda la auditoría; el coordinador, solo sus propias acciones (ADR 017)
router.use(authenticateToken);
router.use(requireRole('encargado', 'coordinador'));

router.get('/opciones', opcionesAuditoria);
router.get('/', listarAuditoria);

export default router;
