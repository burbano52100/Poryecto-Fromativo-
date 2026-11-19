import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send } from 'lucide-react';
import { Card, Chip, toast } from '@heroui/react';
import { FormField } from '../molecules/FormField';
import { TextAreaField } from '../molecules/TextAreaField';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { SectionCard } from '../molecules/SectionCard';
import { Button } from '../atoms/Button';
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

/** Buzón de Aprendiz e Instructor: envía al Encargado y muestra sus respuestas. */
export const BuzonSugerenciasSection = () => {
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
          toast.success('¡Sugerencia enviada con éxito!', {
            description: 'El encargado del comedor revisará tu mensaje.',
          });
          reset();
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        titulo="Buzón de sugerencias"
        descripcion="Tu mensaje llega directo al encargado del comedor, que revisa cada sugerencia."
      >

        {crearSugerencia.isError && (
          <ErrorAlert error={crearSugerencia.error} titulo="No se pudo enviar la sugerencia" />
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField
            label="Asunto"
            error={errors.subject?.message}
            {...register('subject')}
            placeholder="Ej: Sugerencia sobre el menú"
          />
          <TextAreaField
            label="Mensaje"
            rows={5}
            placeholder="Escribe aquí tu sugerencia, comentario o idea..."
            error={errors.message?.message}
            {...register('message')}
          />
          <Button type="submit" isPending={crearSugerencia.isPending} className="self-end">
            <Send />
            Enviar Sugerencia
          </Button>
        </form>
      </SectionCard>

      {misSugerencias.length > 0 && (
        <SectionCard titulo="Mis sugerencias">
          <div className="flex flex-col gap-3">
            {misSugerencias.map((sugerencia) => (
              <Card key={sugerencia.id} variant="secondary">
                <Card.Header className="flex-row flex-wrap items-center justify-between gap-2">
                  <Card.Title>{sugerencia.subject}</Card.Title>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{sugerencia.date}</span>
                    <Chip size="sm" variant="soft" color={sugerencia.status === 'ATENDIDA' ? 'success' : 'warning'}>
                      {sugerencia.status === 'ATENDIDA' ? 'Atendida' : 'Pendiente'}
                    </Chip>
                  </div>
                </Card.Header>
                <Card.Content>
                  <p className="text-sm text-muted">{sugerencia.message}</p>
                  {sugerencia.respuesta && (
                    <p className="mt-2 rounded-lg border-l-2 border-accent bg-surface p-3 text-sm text-foreground">
                      <span className="font-medium">Respuesta del comedor:</span> {sugerencia.respuesta}
                    </p>
                  )}
                </Card.Content>
              </Card>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
};
