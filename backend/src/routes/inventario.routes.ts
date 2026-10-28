import { Router } from 'express';
import {
  getMateriales,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  registrarEntrada,
  registrarSalida,
  getRecetas,
  createReceta,
  updateReceta,
  getKardex,
  getMermas,
  addMerma,
} from '../controllers/inventario.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('encargado'));

router.get('/materiales', getMateriales);
router.post('/materiales', addMaterial);
router.patch('/materiales/:id', updateMaterial);
router.delete('/materiales/:id', deleteMaterial);
router.post('/materiales/:id/entradas', registrarEntrada);
router.post('/materiales/:id/salidas', registrarSalida);
router.get('/recetas', getRecetas);
router.post('/recetas', createReceta);
router.put('/recetas/:id', updateReceta);
router.get('/kardex', getKardex);
router.get('/mermas', getMermas);
router.post('/mermas', addMerma);

export default router;
