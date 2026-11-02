import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Send, Info, CheckCircle2, MessageSquareReply, Clock } from 'lucide-react';
import { FormField } from '../molecules/FormField';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { useCrearSugerencia, useSugerencias } from '../../hooks/useSugerencias';

const sugestionSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, 'El asunto debe tener al menos 3 caracteres')
    .max(150, 'El asunto no debe superar 150 caracteres'),
  message: z
    .string()
    .trim()
    .min(10, 'El mensaje debe tener al menos 10 caracteres')
    .max(2000, 'El mensaje no debe superar 2000 caracteres'),
});

type SuggestionFormData = z.infer<typeof sugestionSchema>;

/** Buzón de Aprendiz, Instructor e Invitado: envía al Encargado y muestra sus respuestas. */
export const BuzonSugerenciasSection = () => {
  const [isSuccess, setIsSuccess] = useState(false);
  const crearSugerencia = useCrearSugerencia();
  const { data: misSugerencias = [] } = useSugerencias();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SuggestionFormData>({
    resolver: zodResolver(sugestionSchema),
  });

  const onSubmit = (data: SuggestionFormData) => {
    crearSugerencia.mutate(
      { asunto: data.subject, mensaje: data.message },
      {
        onSuccess: () => {
          setIsSuccess(true);
          reset();
        },
      }
    );
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80">
      <div className="mb-6 pb-4 border-b border-gray-100">
        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
          <Mail className="w-6 h-6 text-green-600" />
          Buzón de Sugerencias
        </h2>
        <p className="text-sm text-gray-500 mt-1 font-medium">
          Comparte tus ideas, comentarios o sugerencias para mejorar nuestro servicio
        </p>
      </div>

      {isSuccess && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-emerald-900">¡Sugerencia enviada con éxito!</h4>
            <p className="text-xs text-emerald-700 mt-0.5">
              Gracias por tu aporte. El encargado del comedor SENA revisará tu mensaje.
            </p>
          </div>
          <button
            onClick={() => setIsSuccess(false)}
            className="text-xs text-emerald-600 font-bold hover:underline"
          >
            Enviar otra
          </button>
        </div>
      )}

      {crearSugerencia.isError && (
        <div className="mb-6">
          <ErrorAlert error={crearSugerencia.error} titulo="No se pudo enviar la sugerencia" />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <FormField
          label="Asunto"
          error={errors.subject?.message}
          {...register('subject')}
          placeholder="Ej: Sugerencia sobre el menú"
        />

        <div className="space-y-1.5">
          <label htmlFor="sugerencia-mensaje" className="block text-sm font-semibold text-gray-700">
            Mensaje
          </label>
          <textarea
            id="sugerencia-mensaje"
            rows={5}
            placeholder="Escribe aquí tu sugerencia, comentario o idea..."
            className={`w-full rounded-2xl p-3.5 text-sm bg-gray-50 border transition duration-200 focus:outline-none focus:bg-white ${
              errors.message
                ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
            }`}
            {...register('message')}
          />
          {errors.message && (
            <p className="text-xs font-semibold text-red-600">{errors.message.message}</p>
          )}
        </div>

        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed font-medium">
            <span className="font-bold">Nota:</span> Tu sugerencia será enviada directamente al encargado del comedor. Todas las sugerencias son revisadas y tomadas en cuenta para mejorar nuestro servicio.
          </p>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={crearSugerencia.isPending}
          icon={<Send className="w-4 h-4" />}
          className="py-3.5 text-base font-bold bg-green-600 hover:bg-green-700 shadow-green-600/30"
        >
          Enviar Sugerencia
        </Button>
      </form>

      {misSugerencias.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
          <h3 className="text-base font-extrabold text-gray-900">Mis sugerencias</h3>
          {misSugerencias.map((sugerencia) => (
            <article key={sugerencia.id} className="rounded-2xl border border-gray-200 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900">{sugerencia.subject}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium">{sugerencia.date}</span>
                  {sugerencia.status === 'ATENDIDA' ? (
                    <Badge variant="green">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Atendida
                    </Badge>
                  ) : (
                    <Badge variant="amber">
                      <Clock className="w-3.5 h-3.5" /> Pendiente
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600">{sugerencia.message}</p>
              {sugerencia.respuesta && (
                <p className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex gap-2">
                  <MessageSquareReply className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <span className="font-bold">Respuesta del comedor:</span> {sugerencia.respuesta}
                  </span>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
