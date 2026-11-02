import jwt from 'jsonwebtoken';
import { pool } from '../../db/index.js';

export type Rol = 'aprendiz' | 'instructor' | 'encargado' | 'invitado';

export interface UsuarioTest {
  id: string;
  cedula: string;
  nombre: string;
  rol: Rol;
  token: string;
}

export const firmarToken = (user: { id: string; cedula: string; nombre: string }, rol: Rol): string =>
  jwt.sign({ id: user.id, document: user.cedula, name: user.nombre, role: rol }, process.env.JWT_SECRET as string, {
    expiresIn: '2d',
  });

/** Inserta un usuario directamente en la BD y devuelve sus datos con un token firmado. */
export const crearUsuario = async (
  nombre: string,
  cedula: string,
  rol: Rol,
  extra: { fichaId?: string; esBeneficiario?: boolean; email?: string } = {}
): Promise<UsuarioTest> => {
  const res = await pool.query(
    `INSERT INTO usuarios (nombre, cedula, rol, ficha_id, es_beneficiario, email)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, cedula, nombre;`,
    [nombre, cedula, rol, extra.fichaId ?? null, extra.esBeneficiario ?? false, extra.email ?? null]
  );
  const user = res.rows[0];
  return { ...user, rol, token: firmarToken(user, rol) };
};

export const crearFicha = async (codigo: string, programa = 'ADSO'): Promise<string> => {
  const res = await pool.query(
    'INSERT INTO fichas (codigo_ficha, programa, jornada) VALUES ($1, $2, $3) RETURNING id;',
    [codigo, programa, 'mañana']
  );
  return res.rows[0].id;
};

/** Crea un menú del día (hoy por defecto, según el reloj de PostgreSQL) y devuelve su id. */
export const crearMenu = async (
  nombre: string,
  opciones: { estado?: string; disponible?: number; vendida?: number; diasAtras?: number } = {}
): Promise<string> => {
  const res = await pool.query(
    `INSERT INTO menus_dia (fecha, nombre, precio_aprendiz, precio_invitado, cantidad_disponible, cantidad_vendida, estado)
     VALUES ((NOW() AT TIME ZONE 'America/Bogota')::date - $5::int, $1, 5000, 8000, $2, $3, $4)
     RETURNING id;`,
    [nombre, opciones.disponible ?? 50, opciones.vendida ?? 0, opciones.estado ?? 'activo', opciones.diasAtras ?? 0]
  );
  return res.rows[0].id;
};
