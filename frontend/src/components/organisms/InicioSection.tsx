import { Chip } from '@heroui/react';
import { Award } from 'lucide-react';
import type { User } from '../../schemas/auth.schema';
import { ReservaAlmuerzoCard } from './ReservaAlmuerzoCard';
import { useMenuActivo } from '../../hooks/useMenu';

export interface InicioSectionProps {
  user: User;
}

/** Inicio del aprendiz: solo el menú del día para reservar. Lo que debe y su historial van en Mis fichas. */
export const InicioSection = ({ user }: InicioSectionProps) => {
  const { data: menu } = useMenuActivo();
  // El estado de beneficiario vigente lo reporta el menú (se lee de la BD en cada consulta)
  const esBeneficiario = menu?.es_beneficiario ?? user.es_beneficiario ?? false;
  const primerNombre = user.name.split(' ')[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Saludo corto, sin tarjeta: lo primero que se ve es el menú del día para reservar */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold text-foreground">Hola, {primerNombre}</h3>
          {esBeneficiario && (
            <Chip size="sm" variant="soft" color="warning">
              <Award className="size-3.5" />
              <Chip.Label>Beneficiario</Chip.Label>
            </Chip>
          )}
          <Chip size="sm" variant="soft" color="accent">
            Ficha {user.ficha || 'sin asignar'}
          </Chip>
        </div>
        <p className="text-sm text-muted">
          {esBeneficiario
            ? 'Tienes alimentación 100 % subsidiada por el SENA: reserva el almuerzo del día con un clic'
            : 'Reserva el almuerzo del día con anticipación y presenta tu documento o ficha al ingresar'}
        </p>
      </div>

      <ReservaAlmuerzoCard
        user={user}
        tituloConfirmacion="Confirmar reserva de almuerzo"
        detalleConfirmacion={(precio) => (
          <div className="flex flex-col gap-3">
            <p>
              ¿Reservas el menú del día por <span className="font-medium text-foreground">{precio} COP</span>? Lo
              pagas en la ventanilla del comedor.
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-surface-secondary p-3 text-xs">
              <dt>Aprendiz</dt>
              <dd className="text-foreground">{user.name}</dd>
              <dt>Cédula</dt>
              <dd className="text-foreground">{user.document}</dd>
              <dt>Ficha</dt>
              <dd className="text-foreground">{user.ficha || 'Sin ficha'}</dd>
            </dl>
          </div>
        )}
        mensajeExito={(reserva) =>
          reserva.estado_pago === 'gratis'
            ? 'Tarifa: $0 COP (beneficio 100 % subsidiado). Presenta tu documento o ficha en el comedor.'
            : `Tarifa: ${reserva.price} COP. Queda pendiente de pago hasta que la canceles en la ventanilla.`
        }
      />
    </div>
  );
};
