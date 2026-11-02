import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User as UserIcon, Edit, IdCard, BookOpen, Mail, ShieldCheck, X, Check, CreditCard, DollarSign } from 'lucide-react';
import type { User } from '../../schemas/auth.schema';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { FormField } from '../molecules/FormField';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { useActualizarPerfil } from '../../hooks/usePerfil';
import { useResumenConsumos } from '../../hooks/useConsumos';
import { useMiCuenta } from '../../hooks/useCartera';
import { pesos } from '../../lib/formato';

const perfilSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().trim().email('Ingresa un correo institucional válido'),
  ficha: z.string().trim().optional(),
});

type PerfilForm = z.infer<typeof perfilSchema>;

export interface PerfilSectionProps {
  user: User;
}

export const PerfilSection = ({ user }: PerfilSectionProps) => {
  const isInstructor = user.role === 'instructor';
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const actualizarPerfil = useActualizarPerfil();
  const { data: resumen } = useResumenConsumos();
  const { data: cuenta } = useMiCuenta(isInstructor);
  const saldoPendiente = cuenta?.pendingBalance ?? 0;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PerfilForm>({
    resolver: zodResolver(perfilSchema),
    values: { name: user.name, email: user.email, ficha: user.ficha ?? '' },
  });

  const toggleEdicion = () => {
    reset();
    actualizarPerfil.reset();
    setIsEditing(!isEditing);
  };

  const onSubmit = handleSubmit((data) => {
    actualizarPerfil.mutate(
      { name: data.name, email: data.email, ficha: isInstructor ? undefined : data.ficha || undefined },
      {
        onSuccess: () => {
          setIsEditing(false);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        },
      }
    );
  });

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <UserIcon className="w-6 h-6 text-green-600" />
            Mi Perfil
          </h2>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Mantén tu información personal actualizada
          </p>
        </div>

        <Button
          variant="outline"
          onClick={toggleEdicion}
          icon={isEditing ? <X className="w-4 h-4 text-gray-600" /> : <Edit className="w-4 h-4 text-green-600" />}
          className="border-green-600/30 text-green-700 hover:bg-emerald-50 font-bold px-4 py-2.5"
        >
          {isEditing ? 'Cancelar' : 'Editar Perfil'}
        </Button>
      </div>

      {saveSuccess && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>¡Perfil actualizado correctamente!</span>
        </div>
      )}

      {/* Main Avatar Profile Card */}
      <div
        className={`flex items-center gap-5 p-5 rounded-2xl border mb-8 ${
          isInstructor
            ? 'bg-gradient-to-r from-blue-50/70 to-indigo-50/40 border-blue-100'
            : 'bg-gradient-to-r from-emerald-50/70 to-green-50/40 border-emerald-100'
        }`}
      >
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center shrink-0 shadow-md border-4 ${
            isInstructor
              ? 'bg-blue-100 border-blue-400 text-blue-700'
              : 'bg-emerald-100 border-emerald-400 text-emerald-700'
          }`}
        >
          <UserIcon className="w-10 h-10" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-black text-gray-900 break-words">{user.name}</h3>
            <Badge variant={isInstructor ? 'blue' : 'green'}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {user.status || 'ACTIVE'}
            </Badge>
          </div>
          <p className={`text-sm font-semibold mt-0.5 ${isInstructor ? 'text-indigo-700' : 'text-emerald-700'}`}>
            {isInstructor ? 'Instructor SENA' : user.role === 'invitado' ? 'Invitado' : 'Aprendiz SENA'}
          </p>
          <p className="text-xs text-gray-500 mt-1 font-medium break-all">{user.email || 'Sin correo registrado'}</p>
        </div>
      </div>

      {/* Profile Details Grid or Edit Form */}
      {isEditing ? (
        <form onSubmit={onSubmit} noValidate className="bg-gray-50/80 p-6 rounded-2xl border border-gray-200 space-y-4 mb-8">
          <h4 className="text-base font-bold text-gray-900 mb-2">Modificar datos personales</h4>

          {actualizarPerfil.isError && (
            <ErrorAlert error={actualizarPerfil.error} titulo="No se pudo guardar el perfil" />
          )}

          <FormField label="Nombre Completo" required error={errors.name?.message} {...register('name')} />
          <FormField
            label="Correo Institucional"
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          {user.role === 'aprendiz' && (
            <FormField label="ID de Ficha" error={errors.ficha?.message} {...register('ficha')} />
          )}

          <div className="pt-2 flex justify-end gap-3">
            <Button variant="secondary" onClick={toggleEdicion}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={actualizarPerfil.isPending}>
              Guardar Cambios
            </Button>
          </div>
        </form>
      ) : isInstructor ? (
        /* Instructor Specific Details Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80 flex items-center gap-3">
            <IdCard className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cédula</p>
              <p className="text-lg font-bold text-gray-800 mt-0.5">{user.document}</p>
            </div>
          </div>

          <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-indigo-600 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipo de Cuenta</p>
              <p className="text-lg font-bold text-gray-800 mt-0.5">{cuenta?.paymentFrequency ?? 'Mensual'}</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100/80 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Total Consumos</p>
              <p className="text-2xl font-black text-blue-900 mt-0.5">{resumen?.totalAlmuerzos ?? '…'}</p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              saldoPendiente <= 0 ? 'bg-emerald-50/60 border-emerald-100/80' : 'bg-amber-50/60 border-amber-100/80'
            }`}
          >
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-wider ${
                  saldoPendiente <= 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                Saldo
              </p>
              <p className={`text-2xl font-black mt-0.5 ${saldoPendiente <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {pesos(saldoPendiente)}
              </p>
            </div>

            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                saldoPendiente <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {saldoPendiente <= 0 ? 'Al día' : 'Pendiente'}
            </span>
          </div>
        </div>
      ) : (
        /* Aprendiz / Invitado Details Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80 flex items-center gap-3">
            <IdCard className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cédula / Documento</p>
              <p className="text-lg font-bold text-gray-800 mt-0.5">{user.document}</p>
            </div>
          </div>

          {user.role === 'aprendiz' && (
            <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80 flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ficha</p>
                <p className="text-lg font-bold text-gray-800 mt-0.5">{user.ficha || 'Sin ficha'}</p>
              </div>
            </div>
          )}

          <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100/80 flex items-center gap-3 min-w-0">
            <Mail className="w-5 h-5 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Correo Institucional</p>
              <p className="text-sm font-bold text-blue-900 mt-0.5 break-all">{user.email || 'Sin correo registrado'}</p>
            </div>
          </div>

          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Total Almuerzos</p>
              <p className="text-2xl font-black text-emerald-700 mt-0.5">{resumen?.totalAlmuerzos ?? '…'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Total Gastado</p>
              <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {resumen ? pesos(resumen.gastoTotal) : '…'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
