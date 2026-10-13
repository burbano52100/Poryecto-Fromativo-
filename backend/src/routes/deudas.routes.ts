import { Router } from 'express';
import { getDeudas, getMiCuenta, registrarPagoDeuda } from '../controllers/deudas.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.get('/mi-cuenta', authenticateToken, getMiCuenta);
router.get('/', authenticateToken, requireRole('encargado'), getDeudas);
router.post('/:id/pagar', authenticateToken, requireRole('encargado'), registrarPagoDeuda);

export default router;
