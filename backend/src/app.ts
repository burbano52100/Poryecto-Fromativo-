import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import menuRoutes from './routes/menu.routes.js';
import ventasRoutes from './routes/ventas.routes.js';
import consumosRoutes from './routes/consumos.routes.js';
import deudasRoutes from './routes/deudas.routes.js';
import inventarioRoutes from './routes/inventario.routes.js';
import gruposRoutes from './routes/grupos.routes.js';
import sugerenciasRoutes from './routes/sugerencias.routes.js';
import institucionesRoutes from './routes/instituciones.routes.js';
import visitasRoutes from './routes/visitas.routes.js';
import perfilRoutes from './routes/perfil.routes.js';
import healthRoutes from './routes/health.routes.js';
import { getInstructoresList } from './controllers/instituciones.controller.js';
import { authenticateToken } from './middleware/auth.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

dotenv.config();

export const createApp = (): Express => {
  const app = express();

  // 1. Confianza en el proxy inverso (Render, Heroku, Cloudflare)
  app.set('trust proxy', 1);

  // 2. Encabezados de seguridad HTTP
  app.use(helmet());

  // 3. Orígenes permitidos para CORS
  const configuredOrigin = process.env.FRONTEND_URL;
  const allowedOrigins = [
    'http://localhost:5173',
    'https://burbano52100.github.io',
  ];
  if (configuredOrigin && !allowedOrigins.includes(configuredOrigin)) {
    allowedOrigins.push(configuredOrigin);
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests without Origin (e.g., curl, mobile apps)
        if (!origin) {
          return callback(null, true);
        }
        // Exact match against whitelist
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Reject others
        return callback(new Error('Origin not allowed by CORS'), false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
      credentials: true,
    })
  );

  // 4. Parser de cuerpos JSON
  app.use(express.json());

  // 5. Montaje de rutas API
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/menus', menuRoutes);
  app.use('/api/ventas', ventasRoutes);
  app.use('/api/consumos', consumosRoutes);
  app.use('/api/deudas', deudasRoutes);
  app.use('/api/inventario', inventarioRoutes);
  app.use('/api/grupos', gruposRoutes);
  app.use('/api/sugerencias', sugerenciasRoutes);
  app.use('/api/instituciones', institucionesRoutes);
  app.use('/api/visitas', visitasRoutes);
  app.get('/api/instructores', authenticateToken, getInstructoresList);
  app.use('/api/perfil', perfilRoutes);

  // 6. Manejo de rutas inexistentes (404)
  app.use((_req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada en el servidor de GastroSENA.' });
  });

  // 7. Middleware global de errores
  app.use(errorHandler);

  return app;
};
