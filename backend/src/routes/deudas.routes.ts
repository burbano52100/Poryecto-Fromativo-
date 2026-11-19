import { Router } from 'express';
import { getDeudas, getMiCuenta, registrarPagoDeuda } from '../controllers/deudas.controller.js';
import {
  historialRecordatorios,
  recordatorioIndividual,
  recordatorioMasivo,
} from '../controllers/recordatorios.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.get('/mi-cuenta', authenticateToken, getMiCuenta);
router.get('/', authenticateToken, requireRole('encargado'), getDeudas);
router.post('/:id/pagar', authenticateToken, requireRole('encargado'), registrarPagoDeuda);

// Recordatorios por correo a instructores con deuda (ADR 023)
router.get('/recordatorios', authenticateToken, requireRole('encargado'), historialRecordatorios);
router.post('/recordatorios', authenticateToken, requireRole('encargado'), recordatorioMasivo);
router.post('/recordatorios/:instructorId', authenticateToken, requireRole('encargado'), recordatorioIndividual);

export default router;
