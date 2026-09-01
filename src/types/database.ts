export type RolUsuario = 'aprendiz' | 'instructor' | 'encargado' | 'invitado'
export type MetodoVerificacion = 'facial' | 'qr' | 'manual'

export interface Ficha {
  id: string
  codigo_ficha: string
  programa: string
  instructor_id: string | null
  created_at: string
  updated_at: string
}

export interface Usuario {
  id: string
  nombre: string
  cedula: string
  email: string | null
  password_hash: string | null
  rol: RolUsuario
  ficha_id: string | null
  saldo: number
  precio_almuerzo_fijo: number | null
  codigo_qr: string | null
  foto_url: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface ReconocimientoFacial {
  id: string
  usuario_id: string
  modelo: string
  creado_en: string
}
