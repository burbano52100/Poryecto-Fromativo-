import { Router } from 'express';
import { cerrarDia, getHistorialCierres, getResumenCierre, reabrirDia } from '../controllers/cierresCaja.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

// Solo el encargado (el coordinador no ve cierres de caja)
router.use(authenticateToken);
router.use(requireRole('encargado'));

router.get('/resumen', getResumenCierre);
router.get('/', getHistorialCierres);
router.post('/', cerrarDia);
router.post('/:fecha/reabrir', reabrirDia);

export default router;
