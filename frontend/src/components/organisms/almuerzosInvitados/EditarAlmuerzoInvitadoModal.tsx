import { useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { Chip } from '@heroui/react';
import { Button } from '../../atoms/Button';
import { FormField } from '../../molecules/FormField';
import { FormModal } from '../../molecules/FormModal';
import { NumberStepper } from '../../molecules/NumberStepper';
import { ErrorAlert } from '../../molecules/ErrorAlert';
import { useEditarAlmuerzoInvitado } from '../../../hooks/useAlmuerzosInvitados';
import {
  crearEdicionInvitadoSchema,
  ETIQUETA_TIPO_INVITADO,
  personasEscritas,
  textoPersonas,
  type EdicionInvitadoData,
  type EdicionInvitadoForm,
} from '../../../schemas/almuerzosInvitados.schema';
import { ahoraBogotaLocal, pesos } from '../../../lib/formato';
import type { AlmuerzoInvitado } from '../../../types/api';
import { ESTILO_TIPO_INVITADO } from './estiloTipo';

interface EditarAlmuerzoInvitadoModalProps {
  registro: AlmuerzoInvitado;
  maxPersonas: number;
  onCerrar: () => void;
}

/**
 * Corrige personas, nombre y fecha de un registro. El tipo y el precio unitario no cambian:
 * el total se recalcula con el precio con el que se registró.
 */
export const EditarAlmuerzoInvitadoModal = ({ registro, maxPersonas, onCerrar }: EditarAlmuerzoInvitadoModalProps) => {
  const editar = useEditarAlmuerzoInvitado();
  const schema = useMemo(() => crearEdicionInvitadoSchema(maxPersonas), [maxPersonas]);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EdicionInvitadoForm, unknown, EdicionInvitadoData>({
    resolver: zodResolver(schema),
    defaultValues: {
      personas: String(registro.cantidad),
      nombre: registro.nombre_invitado ?? '',
      fechaHora: registro.fecha_local,
    },
  });

  const personas = personasEscritas(useWatch({ control, name: 'personas' }));

  const onSubmit = handleSubmit((data) =>
    editar.mutate(
      {
        id: registro.id,
        cambios: { cantidad: data.personas, nombre_invitado: data.nombre, fecha_hora: data.fechaHora },
      },
      { onSuccess: onCerrar }
    )
  );

  return (
    <FormModal abierto titulo="Editar registro" onCerrar={onCerrar}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Chip size="sm" variant="soft" color={ESTILO_TIPO_INVITADO[registro.tipo].color}>
            {ETIQUETA_TIPO_INVITADO[registro.tipo].titulo}
          </Chip>
          <span>
            Precio guardado: <strong className="font-medium text-foreground">{pesos(registro.precio_unitario)}</strong> por
            persona
          </span>
        </div>

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
          placeholder="Opcional"
          maxLength={120}
          error={errors.nombre?.message}
          {...register('nombre')}
        />

        <FormField
          label="Fecha y hora"
          type="datetime-local"
          required
          max={ahoraBogotaLocal()}
          error={errors.fechaHora?.message}
          {...register('fechaHora')}
        />

        <div className="rounded-xl bg-surface-secondary px-4 py-3" aria-live="polite">
          <p className="text-xs text-muted">
            {textoPersonas(personas)} × {pesos(registro.precio_unitario)}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            = {pesos(personas * registro.precio_unitario)}
          </p>
        </div>

        {editar.isError && <ErrorAlert error={editar.error} titulo="No se pudo guardar el cambio" />}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="tertiary" onPress={onCerrar} isDisabled={editar.isPending}>
            Cancelar
          </Button>
          <Button type="submit" isPending={editar.isPending}>
            <Save />
            Guardar cambios
          </Button>
        </div>
      </form>
    </FormModal>
  );
};
