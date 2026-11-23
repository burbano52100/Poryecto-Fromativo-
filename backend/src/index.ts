import dotenv from 'dotenv';
import { createApp } from './app.js';
import { withTransaction } from './services/inventario.service.js';
import { finalizarBeneficiosVencidos } from './services/beneficios.service.js';

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

/** Cada hora terminan los beneficios cuya fecha de fin ya pasó y se avisa al encargado (ADR 019). */
const UNA_HORA_MS = 60 * 60 * 1000;
const revisarBeneficios = () =>
  withTransaction((client) => finalizarBeneficiosVencidos(client))
    .then((n) => {
      if (n > 0) console.log(`[Beneficios] ${n} beneficio(s) finalizado(s) por fecha de fin.`);
    })
    .catch((error) => console.error('[Beneficios] No se pudieron revisar los beneficios vencidos:', error));

app.listen(PORT, () => {
  console.log(`🚀 Servidor Express de SARA escuchando en http://localhost:${PORT}`);
  console.log(`🔒 Modo seguro activo (JWT verificado, Helmet, CORS configurado)`);
  void revisarBeneficios();
  setInterval(revisarBeneficios, UNA_HORA_MS).unref();
});
