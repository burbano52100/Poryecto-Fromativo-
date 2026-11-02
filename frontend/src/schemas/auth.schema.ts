import { z } from 'zod';

// 1. Roles del sistema. El rol de la sesión lo decide el backend (usuarios.rol).
export const accountTypeSchema = z.enum(['aprendiz', 'instructor', 'encargado', 'invitado']);

// Solo estos tipos de cuenta se pueden crear desde el registro público.
export const registrableAccountTypeSchema = z.enum(['aprendiz', 'invitado']);

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

// 3. Registro público: sí pide tipo de cuenta (aprendiz o invitado)
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
      message: 'El ID de Ficha es obligatorio para Aprendices',
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
});

// 5. Respuesta de autenticación
export const authResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
  message: z.string(),
});

export type AccountType = z.infer<typeof accountTypeSchema>;
export type RegistrableAccountType = z.infer<typeof registrableAccountTypeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormInput = z.input<typeof registerSchema>;
export type User = z.infer<typeof userSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
