import { z } from 'zod';

// 1. Tipos de Cuenta válidos (Exclusivamente Aprendiz, Instructor y Encargado)
export const accountTypeSchema = z.enum(['aprendiz', 'instructor', 'encargado']);

// 2. Schema de Validación para el Formulario de Login
export const loginSchema = z
  .object({
    accountType: accountTypeSchema,
    ficha: z.string().optional(),
    document: z
      .string()
      .min(6, 'El número de documento debe tener al menos 6 dígitos')
      .max(12, 'El número de documento no puede superar los 12 dígitos')
      .regex(/^\d+$/, 'El documento solo debe contener números'),
    password: z.string().min(4, 'La contraseña debe tener al menos 4 caracteres'),
  })
  .refine(
    (data) => {
      if (data.accountType === 'aprendiz') {
        return !!data.ficha && data.ficha.trim().length >= 5;
      }
      return true;
    },
    {
      message: 'El ID de Ficha (mínimo 5 números) es obligatorio para el perfil de Aprendiz',
      path: ['ficha'],
    }
  );

// 3. Schema de Registro Real de Usuarios (OPCIÓN A)
export const registerSchema = z
  .object({
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    document: z
      .string()
      .min(6, 'El documento debe tener al menos 6 dígitos')
      .max(12, 'El documento no puede superar 12 dígitos')
      .regex(/^\d+$/, 'El documento solo debe contener números'),
    accountType: accountTypeSchema,
    ficha: z.string().optional(),
    email: z.string().email('Ingresa un correo electrónico válido'),
    password: z.string().min(4, 'La contraseña debe tener al menos 4 caracteres'),
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

// 4. Schema para Usuario devuelto por la API del Backend
export const userSchema = z.object({
  id: z.string(),
  document: z.string(),
  ficha: z.string().optional(),
  name: z.string(),
  role: accountTypeSchema,
  email: z.string().email(),
  status: z.string().default('ACTIVE'),
});

// 5. Schema para Respuesta de Autenticación
export const authResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
  message: z.string(),
});

export const facialLoginSchema = z.object({
  document: z.string().min(6, 'Documento de identidad requerido para biometría'),
});

// Inferencias estricta de tipos TypeScript directamente desde Zod
export type AccountType = z.infer<typeof accountTypeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormInput = z.input<typeof registerSchema>;
export type User = z.infer<typeof userSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type FacialLoginInput = z.infer<typeof facialLoginSchema>;
