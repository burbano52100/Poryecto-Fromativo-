import { Router } from 'express';
import {
  login,
  register,
  facialLogin,
  getMe,
  getUsers,
} from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/login', loginLimiter, login);
router.post('/register', registerLimiter, register);
router.post('/facial-login', facialLogin);
router.get('/me', authenticateToken, getMe);
router.get('/users', authenticateToken, requireRole('encargado'), getUsers);

export default router;
