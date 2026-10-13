import { Router } from 'express';
import {
  getActiveMenu,
  getAllMenus,
  createMenu,
  updateMenuStatus,
} from '../controllers/menu.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.get('/activo', getActiveMenu);
router.get('/', authenticateToken, requireRole('encargado'), getAllMenus);
router.post('/', authenticateToken, requireRole('encargado'), createMenu);
router.patch('/:id/estado', authenticateToken, requireRole('encargado'), updateMenuStatus);

export default router;
