import { useId, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@heroui/react';
import { Button } from '../../atoms/Button';
import { FormField } from '../../molecules/FormField';
import { NumberStepper } from '../../molecules/NumberStepper';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { useRegistrarAlmuerzoInvitado } from '../../../hooks/useAlmuerzosInvitados';
import {
  crearRegistroInvitadoSchema,
  ETIQUETA_TIPO_INVITADO,
  personasEscritas,
  textoPersonas,
  type RegistroInvitadoData,
  type RegistroInvitadoForm,
} from '../../../schemas/almuerzosInvitados.schema';
import { pesos } from '../../../lib/formato';
import type { TipoAlmuerzoInvitado } from '../../../types/api';
import { ESTILO_TIPO_INVITADO } from './estiloTipo';

interface RegistroAlmuerzoInvitadoCardProps {
  tipo: TipoAlmuerzoInvitado;
  /** Tarifa vigente por persona (la envía el backend). */
  precio: number;
  maxPersonas: number;
}

/** Una de las tres separaciones: número de personas × tarifa fija = total, y botón Registrar. */
export const RegistroAlmuerzoInvitadoCard = ({ tipo, precio, maxPersonas }: RegistroAlmuerzoInvitadoCardProps) => {
  const tituloId = useId();
  const registrar = useRegistrarAlmuerzoInvitado();
  const [exito, setExito] = useState<string | null>(null);
  const { icono: Icono, iconoFondo } = ESTILO_TIPO_INVITADO[tipo];

  const schema = useMemo(() => crearRegistroInvitadoSchema(maxPersonas), [maxPersonas]);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegistroInvitadoForm, unknown, RegistroInvitadoData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo, personas: '1', nombre: '' },
  });

  const personas = personasEscritas(useWatch({ control, name: 'personas' }));

  const onSubmit = handleSubmit((data) => {
    setExito(null);
    registrar.mutate(
      { tipo: data.tipo, cantidad: data.personas, nombre_invitado: data.nombre },
      {
        onSuccess: (registro) => {
          reset();
          setExito(`Registrado: ${textoPersonas(registro.cantidad)} · ${pesos(registro.total)}`);
          setTimeout(() => setExito(null), 4000);
        },
      }
    );
  });

  return (
    <Card role="region" aria-labelledby={tituloId} className="gap-4 p-5">
      <Card.Header className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconoFondo}`}>
            <Icono className="size-5" />
          </div>
          <div className="min-w-0">
            <Card.Title id={tituloId}>{ETIQUETA_TIPO_INVITADO[tipo].titulo}</Card.Title>
            <Card.Description className="text-xs">Precio fijo por persona</Card.Description>
          </div>
        </div>
        <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">{pesos(precio)}</span>
      </Card.Header>

      <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4">
        <Controller
          name="personas"
          control={control}
          render={({ field }) => (
            <NumberStepper
              ref={field.ref}
              name={field.name}
              label="Número de personas"
              required
              min={1}
              max={maxPersonas}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.personas?.message}
            />
          )}
        />

        <FormField
          label="Nombre o nota del grupo"
          placeholder="Opcional. Ej: Delegación SENA Neiva"
          maxLength={120}
          error={errors.nombre?.message}
          {...register('nombre')}
        />

        <div className="rounded-xl bg-surface-secondary px-4 py-3" aria-live="polite">
          <p className="text-xs text-muted">
            {textoPersonas(personas)} × {pesos(precio)}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">= {pesos(personas * precio)}</p>
        </div>

        {registrar.isError && (
          <ErrorAlert error={registrar.error} titulo="No se pudo registrar" onCerrar={() => registrar.reset()} />
        )}
        {exito && (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-4 shrink-0" /> {exito}
          </p>
        )}

        <Button type="submit" fullWidth isPending={registrar.isPending} className="mt-auto">
          Registrar
        </Button>
      </form>
    </Card>
  );
};
