import dotenv from 'dotenv';
import { createApp } from './app.js';

dotenv.config();

// Validación estricta de JWT_SECRET
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.trim().length === 0) {
  console.error('[FATAL] JWT_SECRET no está configurado en las variables de entorno.');
  console.error('[FATAL] El servidor se rehúsa a iniciar por motivos de seguridad.');
  process.exit(1);
}

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor Express de GastroSENA escuchando en http://localhost:${PORT}`);
  console.log(`🔒 Modo seguro activo (JWT verificado, Helmet, CORS configurado)`);
});