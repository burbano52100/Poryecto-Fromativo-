import { supabase } from './supabaseClient'
import type { AuthResponse, FacialLoginInput, LoginInput, User } from '../schemas/auth.schema'

// ⚠️ Pendiente de seguridad: `password_hash` se compara en texto plano.
// Esto es un atajo temporal de demo (igual que el localStorage que reemplaza),
// NO apto para producción. Antes de ir a producción: migrar a Supabase Auth
// o, como mínimo, hashear con bcrypt/argon2 y comparar el hash.

interface UsuarioRow {
  id: string
  nombre: string
  cedula: string
  email: string | null
  rol: string
  activo: boolean
  password_hash?: string | null
  fichas?: { codigo_ficha: string } | null
  reconocimiento_facial?: { id: string }[] | null
}

function toUser(row: UsuarioRow): User {
  return {
    id: row.id,
    document: row.cedula,
    ficha: row.fichas?.codigo_ficha,
    name: row.nombre,
    role: row.rol as User['role'],
    email: row.email,
    status: row.activo ? 'ACTIVE' : 'INACTIVE',
  }
}

export async function loginWithPassword(input: LoginInput): Promise<AuthResponse> {
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('id, nombre, cedula, email, rol, activo, password_hash, fichas ( codigo_ficha )')
    .eq('cedula', input.document)
    .eq('rol', input.accountType)
    .maybeSingle<UsuarioRow>()

  if (error) throw new Error('No se pudo consultar el usuario en Supabase.')
  if (!usuario || !usuario.activo) {
    throw new Error('Credenciales inválidas o usuario inactivo.')
  }
  if (usuario.password_hash !== input.password) {
    throw new Error('Credenciales inválidas o usuario inactivo.')
  }
  if (input.accountType === 'aprendiz' && usuario.fichas?.codigo_ficha !== input.ficha) {
    throw new Error('El ID de Ficha no coincide con el registrado para este usuario.')
  }

  return {
    token: usuario.id,
    user: toUser(usuario),
    message: 'Inicio de sesión exitoso',
  }
}

export async function facialLogin(input: FacialLoginInput): Promise<AuthResponse> {
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('id, nombre, cedula, email, rol, activo, fichas ( codigo_ficha ), reconocimiento_facial ( id )')
    .eq('cedula', input.document)
    .maybeSingle<UsuarioRow>()

  if (error) throw new Error('No se pudo consultar el usuario en Supabase.')
  if (!usuario || !usuario.activo) {
    throw new Error('No se encontró un usuario activo con ese documento.')
  }
  if (!usuario.reconocimiento_facial || usuario.reconocimiento_facial.length === 0) {
    throw new Error('Este usuario no tiene reconocimiento facial registrado.')
  }

  return {
    token: usuario.id,
    user: toUser(usuario),
    message: 'Autenticación biométrica exitosa',
  }
}

export async function fetchCurrentUser(token: string): Promise<User | null> {
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('id, nombre, cedula, email, rol, activo, fichas ( codigo_ficha )')
    .eq('id', token)
    .maybeSingle<UsuarioRow>()

  if (error || !usuario || !usuario.activo) return null
  return toUser(usuario)
}
