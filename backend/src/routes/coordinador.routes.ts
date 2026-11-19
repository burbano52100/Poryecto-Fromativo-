import express, { Router } from 'express';
import {
  getResumenCoordinador,
  getSolicitudes,
  aprobarSolicitudes,
  rechazarSolicitudes,
  getUsuarios,
  cambiarEstadoUsuario,
  restablecerClave,
  getFichas,
  cambiarEstadoFicha,
} from '../controllers/coordinador.controller.js';
import {
  descargarPlantilla,
  previsualizarCarga,
  confirmarCargaMasiva,
  historialCargas,
  descargarResultado,
} from '../controllers/cargaMasiva.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { LIMITE_BYTES } from '../services/cargaMasiva.service.js';

const router = Router();

// Todo el módulo es exclusivo del coordinador (ADR 018)
router.use(authenticateToken);
router.use(requireRole('coordinador'));

router.get('/resumen', getResumenCoordinador);

router.get('/solicitudes', getSolicitudes);
router.post('/solicitudes/aprobar', aprobarSolicitudes);
router.post('/solicitudes/rechazar', rechazarSolicitudes);

router.get('/usuarios', getUsuarios);
router.patch('/usuarios/:id/estado', cambiarEstadoUsuario);
router.post('/usuarios/:id/restablecer-clave', restablecerClave);

router.get('/fichas', getFichas);
router.patch('/fichas/:id/estado', cambiarEstadoFicha);

// El archivo llega como cuerpo binario (máximo 5 MB): no hace falta multer
const archivo = express.raw({ type: 'application/octet-stream', limit: LIMITE_BYTES });
router.get('/cargas', historialCargas);
router.get('/cargas/plantilla/:tipo', descargarPlantilla);
router.get('/cargas/:id/resultado', descargarResultado);
router.post('/cargas/:tipo/previsualizar', archivo, previsualizarCarga);
router.post('/cargas/:tipo/confirmar', archivo, confirmarCargaMasiva);

export default router;
