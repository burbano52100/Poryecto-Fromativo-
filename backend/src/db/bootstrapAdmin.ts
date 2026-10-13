import bcrypt from 'bcryptjs';
import { query } from './index.js';

export async function bootstrapAdmin(): Promise<void> {
  const document = process.env.ADMIN_DOCUMENT?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const name = process.env.ADMIN_NAME?.trim() || 'Encargado General Comedor';
  const email = process.env.ADMIN_EMAIL?.trim() || 'encargado@sena.edu.co';

  if (!document || !password) {
    if (process.env.NODE_ENV === 'production') {
      console.log('[Bootstrap Admin] ADMIN_DOCUMENT o ADMIN_PASSWORD no definidos. Omitiendo creación de encargado.');
    }
    return;
  }

  try {
    const existingAdmin = await query(
      "SELECT id, nombre FROM usuarios WHERE rol = 'encargado' LIMIT 1"
    );

    if (existingAdmin.rows.length > 0) {
      console.log(`[Bootstrap Admin] Ya existe un usuario encargado en la base de datos (${existingAdmin.rows[0].nombre}). Omitiendo.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, activo)
       VALUES ($1, $2, $3, $4, 'encargado', true)
       RETURNING id, nombre, cedula, rol`,
      [name, document, email, passwordHash]
    );

    console.log(
      `[Bootstrap Admin] ¡Primer encargado creado con éxito! Nombre: ${result.rows[0].nombre}, Cédula: ${result.rows[0].cedula}`
    );
  } catch (error) {
    console.error('[Bootstrap Admin] Error al intentar bootstrap del encargado:', error);
  }
}
