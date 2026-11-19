import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, IdCard, Lock } from 'lucide-react';
import { Alert, Button as HeroButton, Card } from '@heroui/react';
import { loginSchema, type LoginInput } from '../../schemas/auth.schema';
import { useLoginMutation } from '../../hooks/useAuth';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { RegisterModal } from './RegisterModal';
import { soloNumeros } from '../../lib/numeros';

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
    <Card className="w-full max-w-md p-6 sm:p-8">
      <Card.Header className="mb-2 text-center">
        <Card.Title className="text-xl">Iniciar sesión</Card.Title>
        <Card.Description>Ingresa con tu documento y contraseña</Card.Description>
      </Card.Header>

      <Card.Content className="gap-4">
        {loginMutation.isError && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{loginMutation.error.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField
            label="Cédula / Documento de Identidad"
            placeholder="Ej: 1005678901"
            autoComplete="username"
            required
            icon={<IdCard className="size-4" />}
            error={errors.document?.message}
            {...soloNumeros(register('document'), 'entero')}
          />

          <FormField
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            icon={<Lock className="size-4" />}
            error={errors.password?.message}
            rightElement={
              <HeroButton
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </HeroButton>
            }
            {...register('password')}
          />

          <Button type="submit" fullWidth size="lg" isPending={loginMutation.isPending} className="mt-1">
            Ingresar
          </Button>
        </form>
      </Card.Content>

      <Card.Footer className="mt-2 items-center justify-center gap-1 text-sm text-muted">
        ¿No tienes cuenta?
        <HeroButton size="sm" variant="ghost" className="px-2 text-link" onPress={() => setIsRegisterOpen(true)}>
          Registrarse
        </HeroButton>
      </Card.Footer>

      <RegisterModal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} />
    </Card>
  );
};
