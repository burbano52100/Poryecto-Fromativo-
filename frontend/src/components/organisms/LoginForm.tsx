import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { IdCard, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { loginSchema, type LoginInput } from '../../schemas/auth.schema';
import { useLoginMutation } from '../../hooks/useAuth';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { RegisterModal } from './RegisterModal';

/**
 * Login con documento y contraseña. El backend devuelve el rol de la cuenta y la
 * página de login redirige sola al panel correspondiente.
 */
export const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const loginMutation = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { document: '', password: '' },
  });

  const onSubmit = handleSubmit((data) => loginMutation.mutate(data));

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-md border border-gray-100 text-gray-900">
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Iniciar Sesión</h2>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          Ingresa con tu documento y contraseña
        </p>
      </div>

      {loginMutation.isError && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{loginMutation.error.message}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField
          label="Cédula / Documento de Identidad"
          placeholder="Ej: 1005678901"
          inputMode="numeric"
          autoComplete="username"
          required
          icon={<IdCard className="w-4 h-4" />}
          error={errors.document?.message}
          {...register('document')}
        />

        <FormField
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          icon={<Lock className="w-4 h-4" />}
          error={errors.password?.message}
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          {...register('password')}
        />

        <Button type="submit" variant="primary" fullWidth isLoading={loginMutation.isPending} className="font-bold">
          Ingresar
        </Button>
      </form>

      <div className="text-center mt-5 text-sm text-gray-500">
        ¿No tienes cuenta?{' '}
        <button
          type="button"
          onClick={() => setIsRegisterOpen(true)}
          className="font-bold text-green-600 hover:text-green-700 hover:underline cursor-pointer"
        >
          Registrarse
        </button>
      </div>

      <RegisterModal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} />
    </div>
  );
};
