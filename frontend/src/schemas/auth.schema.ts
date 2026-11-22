import { z } from 'zod';

// 1. Roles del sistema. El rol de la sesión lo decide el backend (usuarios.rol).
export const accountTypeSchema = z.enum(['aprendiz', 'instructor', 'encargado', 'coordinador']);

// El registro público solo ofrece aprendiz e instructor, y ambos quedan pendientes hasta que el
// Coordinador los apruebe (ADR 018). Encargados y coordinadores los crea el equipo.
export const registrableAccountTypeSchema = z.enum(['aprendiz', 'instructor']);

const documentoSchema = z
  .string()
  .trim()
  .min(6, 'El número de documento debe tener al menos 6 dígitos')
  .max(12, 'El número de documento no puede superar los 12 dígitos')
  .regex(/^\d+$/, 'El documento solo debe contener números');

// 2. Login: solo documento y contraseña
export const loginSchema = z.object({
  document: documentoSchema,
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

// 3. Registro público: sí pide tipo de cuenta
export const registerSchema = z
  .object({
    name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres'),
    document: documentoSchema,
    accountType: registrableAccountTypeSchema,
    ficha: z.string().optional(),
    email: z.string().trim().email('Ingresa un correo electrónico válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  })
  .refine(
    (data) => {
      if (data.accountType === 'aprendiz') {
        return !!data.ficha && data.ficha.trim().length >= 5;
      }
      return true;
    },
    {
      message: 'El número de ficha es obligatorio para aprendices',
      path: ['ficha'],
    }
  );

// 4. Usuario devuelto por la API del backend
export const userSchema = z.object({
  id: z.string(),
  document: z.string(),
  ficha: z.string().optional(),
  name: z.string(),
  role: accountTypeSchema,
  email: z.string(),
  status: z.string().default('ACTIVE'),
  es_beneficiario: z.boolean().optional(),
  /** Cuenta creada por carga masiva o con la clave restablecida: debe cambiarla al ingresar. */
  debe_cambiar_clave: z.boolean().optional(),
});

// 5. Respuesta de autenticación
export const authResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
  message: z.string(),
});

/**
 * Respuesta 202 del registro: la cuenta queda pendiente del Coordinador, sin token. Si la cédula
 * ya estaba en una carga masiva, el backend responde 201 con la sesión (AuthResponse).
 */
export interface SolicitudResponse {
  message: string;
  solicitud: { id: string; rol: RegistrableAccountType; estado: 'pendiente' };
}

export type RegisterResponse = AuthResponse | SolicitudResponse;

export const esSolicitud = (respuesta: RegisterResponse): respuesta is SolicitudResponse => 'solicitud' in respuesta;

export type AccountType = z.infer<typeof accountTypeSchema>;
export type RegistrableAccountType = z.infer<typeof registrableAccountTypeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormInput = z.input<typeof registerSchema>;
export type User = z.infer<typeof userSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
