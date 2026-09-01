import { z } from 'zod';

// 1. Schema para Tipo de Cuenta
export const accountTypeSchema = z.enum(['aprendiz', 'instructor', 'encargado']);

// 2. Schema para Formulario de Login (React Hook Form + backend payload)
export const loginSchema = z
  .object({
    accountType: accountTypeSchema,
    ficha: z.string().optional(),
    document: z
      .string()
      .min(6, 'El documento debe tener al menos 6 dígitos')
      .max(12, 'El documento no puede superar 12 dígitos')
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
      message: 'El ID de Ficha (mínimo 5 números) es obligatorio para Aprendices',
      path: ['ficha'],
    }
  );

// 3. Schema para Usuario devuelto por el backend
export const userSchema = z.object({
  id: z.string(),
  document: z.string(),
  ficha: z.string().optional(),
  name: z.string(),
  role: accountTypeSchema,
  email: z.string().email(),
  status: z.string().default('ACTIVE'),
});

// 4. Schema para Respuesta de Login del Backend
export const authResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
  message: z.string(),
});

// 5. Schema para Reconocimiento Facial Payload
export const facialLoginSchema = z.object({
  document: z.string().min(6, 'Documento inválido'),
});

// Inferencias estricta de tipos TypeScript directamente desde Zod
export type AccountType = z.infer<typeof accountTypeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type User = z.infer<typeof userSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type FacialLoginInput = z.infer<typeof facialLoginSchema>;
