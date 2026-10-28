import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Users, 
  Camera, 
  BookOpen, 
  IdCard, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { loginSchema, type LoginInput, type AccountType } from '../../schemas/auth.schema';
import { useLoginMutation, useFacialLoginMutation } from '../../hooks/useAuth';
import { AccountTypeSelector } from '../molecules/AccountTypeSelector';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { RegisterModal } from './RegisterModal';
import { DevQuickLogin } from './DevQuickLogin';

interface LoginFormProps {
  onLoginSuccess?: (role: string, document: string) => void;
}

export const LoginForm = ({ onLoginSuccess }: LoginFormProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFacialModalOpen, setIsFacialModalOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType>('aprendiz');

  const loginMutation = useLoginMutation();
  const facialMutation = useFacialLoginMutation();

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      accountType: 'aprendiz',
      ficha: '',
      document: '',
      password: '',
    },
  });

  const handleAccountTypeChange = (type: AccountType) => {
    setAccountType(type);
    setValue('accountType', type, { shouldValidate: true });
  };

  const onSubmit = (data: LoginInput) => {
    loginMutation.mutate(data, {
      onSuccess: (res) => {
        setLocalFeedback(`¡Bienvenido ${res.user.name}!`);
        if (onLoginSuccess) {
          onLoginSuccess(res.user.role, res.user.document);
        }
      },
      onError: (err) => {
        // En desarrollo local offline, si el backend no está corriendo, permite simulación opcional
        if (import.meta.env.DEV) {
          console.warn('API no conectada en entorno local DEV:', err);
        }
      },
    });
  };

  const handleGuestLogin = () => {
    handleAccountTypeChange('invitado');
    setLocalFeedback('Modo Invitado seleccionado. Ingresa tu documento de identidad.');
    setTimeout(() => setLocalFeedback(null), 3000);
  };

  const handleSimulateFacialSuccess = () => {
    const doc = getValues('document');
    if (!doc) {
      alert('Por favor ingresa primero tu número de documento para la biometría.');
      return;
    }

    facialMutation.mutate(
      { document: doc },
      {
        onSuccess: (res) => {
          setIsFacialModalOpen(false);
          setLocalFeedback(`¡Autenticación Facial Exitosa! Bienvenido ${res.user.name}.`);
          if (onLoginSuccess) {
            onLoginSuccess(res.user.role, res.user.document);
          }
        },
      }
    );
  };

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-white/40 text-gray-900 transition-all duration-300">
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Iniciar Sesión
        </h2>
        <p className="text-gray-500 text-sm mt-1 font-medium">
          Sistema de Control de Almuerzos - GastroSENA
        </p>
      </div>

      {loginMutation.isError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span>
            {loginMutation.error instanceof Error
              ? loginMutation.error.message
              : 'Error al iniciar sesión. Verifica tus credenciales.'}
          </span>
        </div>
      )}

      {localFeedback && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs sm:text-sm flex items-center gap-2 animate-fade-in font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{localFeedback}</span>
        </div>
      )}

      {/* Selector de Tipo de Cuenta */}
      <AccountTypeSelector
        selectedType={accountType}
        onSelect={handleAccountTypeChange}
      />

      {/* Botones de acción complementaria */}
      <div className="space-y-2 mb-5">
        <Button
          variant="outline"
          fullWidth
          onClick={handleGuestLogin}
          icon={<Users className="w-4 h-4 text-gray-600" />}
        >
          Modo Invitado / Visitante
        </Button>

        {import.meta.env.DEV && (
          <Button
            variant="emerald"
            fullWidth
            onClick={() => setIsFacialModalOpen(true)}
            icon={<Camera className="w-4 h-4 text-emerald-600" />}
          >
            Ingresar con Reconocimiento Facial (Dev)
          </Button>
        )}
      </div>

      <div className="relative my-4 flex items-center justify-center">
        <div className="border-t border-gray-200 w-full"></div>
        <span className="bg-white px-3 text-xs text-gray-400 font-medium whitespace-nowrap absolute">
          O ingresa con credenciales
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {accountType === 'aprendiz' && (
          <FormField
            label="ID de Ficha"
            placeholder="Ej: 2847251"
            required={true}
            icon={<BookOpen className="w-4 h-4" />}
            error={errors.ficha?.message}
            {...register('ficha')}
          />
        )}

        <FormField
          label="Cédula / Documento de Identidad"
          placeholder="Ej: 1005678901"
          required
          icon={<IdCard className="w-4 h-4" />}
          error={errors.document?.message}
          {...register('document')}
        />

        <div>
          <FormField
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            required
            icon={<Lock className="w-4 h-4" />}
            error={errors.password?.message}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            {...register('password')}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={loginMutation.isPending}
          className="bg-green-600 hover:bg-green-700 shadow-green-600/30 font-bold"
        >
          Iniciar Sesión
        </Button>
      </form>

      {/* Herramientas de Desarrollo: Solo activas en import.meta.env.DEV */}
      {import.meta.env.DEV && (
        <DevQuickLogin onLoginSuccess={onLoginSuccess} />
      )}

      <div className="text-center mt-4 text-xs text-gray-500">
        ¿No tienes cuenta?{' '}
        <button
          type="button"
          onClick={() => setIsRegisterOpen(true)}
          className="font-bold text-green-600 hover:text-green-700 hover:underline cursor-pointer"
        >
          Crear cuenta
        </button>
      </div>

      {/* Modal de Registro */}
      <RegisterModal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} />

      {/* Modal de Reconocimiento Facial (DEV) */}
      {isFacialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 border border-emerald-200 shadow-2xl">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 border-4 border-emerald-300 animate-pulse">
              <Camera className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">Escanear Rostro SENA</h3>
            <p className="text-xs text-gray-600">
              Colócate frente a la cámara del tótem biométrico en el Comedor GastroSENA.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setIsFacialModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleSimulateFacialSuccess}
                isLoading={facialMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Simular Escaneo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
