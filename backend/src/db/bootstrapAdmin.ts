import bcrypt from 'bcryptjs';
import { query } from './index.js';

interface CuentaInicial {
  rol: 'encargado' | 'coordinador';
  /** Prefijo de las variables de entorno: ADMIN_DOCUMENT, COORDINADOR_PASSWORD, etc. */
  prefijo: 'ADMIN' | 'COORDINADOR';
  nombrePorDefecto: string;
  emailPorDefecto: string;
}

/**
 * Cuentas que nadie puede crear desde la aplicación. El registro solo ofrece aprendiz e
 * instructor, y esas cuentas solo las aprueba el coordinador (ADR 018). Sin un coordinador
 * inicial, nadie podría entrar a una base de producción, donde la semilla no corre.
 */
const CUENTAS_INICIALES: readonly CuentaInicial[] = [
  {
    rol: 'encargado',
    prefijo: 'ADMIN',
    nombrePorDefecto: 'Encargado General Comedor',
    emailPorDefecto: 'encargado@sena.edu.co',
  },
  {
    rol: 'coordinador',
    prefijo: 'COORDINADOR',
    nombrePorDefecto: 'Coordinación Académica',
    emailPorDefecto: 'coordinacion@sena.edu.co',
  },
];

/**
 * Crea el primer encargado (ADMIN_*) y el primer coordinador (COORDINADOR_*) si la base no
 * tiene ninguno de ese rol. Corre después de las migraciones, en cada arranque; si las
 * variables de un rol no están definidas, ese rol se omite. Nunca lanza: un error aquí no
 * debe impedir que el servidor arranque.
 */
export async function bootstrapAdmin(): Promise<void> {
  for (const cuenta of CUENTAS_INICIALES) {
    await crearCuentaInicial(cuenta);
  }
}

async function crearCuentaInicial({ rol, prefijo, nombrePorDefecto, emailPorDefecto }: CuentaInicial): Promise<void> {
  const etiqueta = `[Bootstrap ${rol}]`;
  const document = process.env[`${prefijo}_DOCUMENT`]?.trim();
  const password = process.env[`${prefijo}_PASSWORD`]?.trim();
  const name = process.env[`${prefijo}_NAME`]?.trim() || nombrePorDefecto;
  const email = (process.env[`${prefijo}_EMAIL`]?.trim() || emailPorDefecto).toLowerCase();

  if (!document || !password) {
    if (process.env.NODE_ENV === 'production') {
      console.log(`${etiqueta} ${prefijo}_DOCUMENT o ${prefijo}_PASSWORD no definidos. Omitiendo creación del ${rol}.`);
    }
    return;
  }

  try {
    const existente = await query<{ nombre: string }>('SELECT nombre FROM usuarios WHERE rol = $1 LIMIT 1;', [rol]);
    if (existente.rows.length > 0) {
      console.log(`${etiqueta} Ya existe un ${rol} en la base de datos (${existente.rows[0].nombre}). Omitiendo.`);
      return;
    }

    // Sin esta revisión, el INSERT fallaría con un error de unicidad poco claro en el log de Render
    const ocupado = await query<{ rol: string }>(
      'SELECT rol FROM usuarios WHERE cedula = $1 OR lower(email) = $2 LIMIT 1;',
      [document, email]
    );
    if (ocupado.rows.length > 0) {
      console.error(
        `${etiqueta} El documento o el correo ya pertenecen a una cuenta de ${ocupado.rows[0].rol}. ` +
          `Usa otros valores en ${prefijo}_DOCUMENT y ${prefijo}_EMAIL. No se creó el ${rol}.`
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query<{ nombre: string; cedula: string }>(
      `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, estado)
       VALUES ($1, $2, $3, $4, $5, 'activo')
       RETURNING nombre, cedula;`,
      [name, document, email, passwordHash, rol]
    );

    console.log(
      `${etiqueta} Primer ${rol} creado con éxito. Nombre: ${result.rows[0].nombre}, Cédula: ${result.rows[0].cedula}`
    );
  } catch (error) {
    console.error(`${etiqueta} Error al crear la cuenta inicial:`, error);
  }
}
