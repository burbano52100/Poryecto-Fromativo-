import { Router } from 'express';
import { descargarReporte } from '../controllers/reportes.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

// Cada reporte valida además su propio rol (ventas e inventario: encargado; usuarios: coordinador)
router.get('/:tipo', authenticateToken, requireRole('encargado', 'coordinador'), descargarReporte);

export default router;
