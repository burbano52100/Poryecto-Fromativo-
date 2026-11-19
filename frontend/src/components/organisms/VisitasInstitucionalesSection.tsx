import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, DollarSign, Users } from 'lucide-react';
import { Alert, Chip, Table, toast } from '@heroui/react';
import { apiClient } from '../../lib/api';
import { filtrarNumero } from '../../lib/numeros';
import { fechaCorta } from '../../lib/formato';
import {
  MAX_NOMBRE_VISITA,
  nombresVisitaSchema,
  type ErroresNombresVisita,
  type NombresVisita,
} from '../../schemas/visitas.schema';
import { Button } from '../atoms/Button';
import { StatCard } from '../atoms/StatCard';
import { EmptyMessage } from '../molecules/EmptyMessage';
import { FormField } from '../molecules/FormField';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { SectionCard } from '../molecules/SectionCard';

interface Visita {
  id: string;
  /** Institución y responsable tal como los escribió el encargado. */
  institucion_nombre: string;
  responsable_nombre: string;
  cantidad_personas: number;
  fecha_visita: string;
  precio_unitario: number;
  total_a_cobrar: number;
  estado: string;
  metodo_pago: string;
  estado_pago: string;
  created_at: string;
}

interface VisitasKpi {
  totalVisitasMes: number;
  totalPersonasAtendidas: number;
  ingresosVisitas: number;
}

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/**
 * Visitas institucionales (Encargado): colegios, universidades y empresas que almuerzan en el
 * comedor. Antes era una página suelta sin ruta; ahora es una sección del panel.
 */
export function VisitasInstitucionalesSection() {
  const queryClient = useQueryClient();

  const [institucionNombre, setInstitucionNombre] = useState('');
  const [responsableNombre, setResponsableNombre] = useState('');
  const [erroresNombres, setErroresNombres] = useState<ErroresNombresVisita>({});
  const [cantidadPersonas, setCantidadPersonas] = useState('');
  const [fechaVisita, setFechaVisita] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const visitasQuery = useQuery({
    queryKey: ['visitas'],
    queryFn: async () => (await apiClient.get<Visita[]>('/visitas')).data,
  });

  const kpiQuery = useQuery({
    queryKey: ['visitas', 'kpi'],
    queryFn: async () => (await apiClient.get<VisitasKpi>('/visitas/kpi')).data,
  });

  const crearVisitaMutation = useMutation({
    mutationFn: async (payload: NombresVisita & { cantidad_personas: number; fecha_visita: string }) =>
      (await apiClient.post<Visita>('/visitas', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      queryClient.invalidateQueries({ queryKey: ['visitas', 'kpi'] });
      toast.success('¡Visita registrada correctamente!');
      setInstitucionNombre('');
      setResponsableNombre('');
      setErroresNombres({});
      setCantidadPersonas('');
      setFechaVisita('');
    },
    onError: () => {
      setFormError('No fue posible registrar la visita. Intenta nuevamente.');
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    // Institución y responsable: cada error se muestra debajo de su campo
    const nombres = nombresVisitaSchema.safeParse({ institucionNombre, responsableNombre });
    const errores: ErroresNombresVisita = {};
    if (!nombres.success) {
      for (const issue of nombres.error.issues) {
        const campo = issue.path[0] as keyof NombresVisita;
        errores[campo] ??= issue.message;
      }
    }
    setErroresNombres(errores);

    const cantidad = Number(cantidadPersonas);
    if (!cantidad || cantidad <= 0) {
      setFormError('La cantidad de personas debe ser un número mayor a cero.');
      return;
    }

    if (!fechaVisita) {
      setFormError('Selecciona la fecha de la visita.');
      return;
    }

    if (!nombres.success) return;

    crearVisitaMutation.mutate({
      ...nombres.data,
      cantidad_personas: cantidad,
      fecha_visita: fechaVisita,
    });
  };

  const kpi = kpiQuery.data;
  const visitas = visitasQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Visitas del mes"
          value={kpiQuery.isLoading ? undefined : (kpi?.totalVisitasMes ?? 0)}
          icon={<CalendarClock className="size-5" />}
          tone="accent"
        />
        <StatCard
          title="Personas atendidas"
          value={kpiQuery.isLoading ? undefined : (kpi?.totalPersonasAtendidas ?? 0)}
          icon={<Users className="size-5" />}
          tone="warning"
        />
        <StatCard
          title="Ingresos por visitas"
          value={kpiQuery.isLoading ? undefined : currencyFormatter.format(kpi?.ingresosVisitas ?? 0)}
          icon={<DollarSign className="size-5" />}
          tone="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <SectionCard
          className="h-fit lg:col-span-2"
          titulo="Registrar nueva visita"
          descripcion="Colegios, universidades y empresas que almuerzan en el comedor"
        >
          {formError && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{formError}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}


          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField
              label="Nombre de la Institución"
              placeholder="Ej: Colegio San José"
              required
              maxLength={MAX_NOMBRE_VISITA}
              value={institucionNombre}
              error={erroresNombres.institucionNombre}
              onChange={(e) => {
                setInstitucionNombre(e.target.value);
                setErroresNombres((errores) => ({ ...errores, institucionNombre: undefined }));
              }}
            />

            <FormField
              label="Nombre del Responsable"
              placeholder="Ej: María Fernanda Gómez"
              required
              maxLength={MAX_NOMBRE_VISITA}
              value={responsableNombre}
              error={erroresNombres.responsableNombre}
              onChange={(e) => {
                setResponsableNombre(e.target.value);
                setErroresNombres((errores) => ({ ...errores, responsableNombre: undefined }));
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <FormField
                label="Cantidad de Personas"
                inputMode="numeric"
                placeholder="Ej: 25"
                required
                value={cantidadPersonas}
                onChange={(e) => {
                  filtrarNumero(e, 'entero');
                  setCantidadPersonas(e.target.value);
                }}
              />

              <FormField
                label="Fecha de la Visita"
                type="date"
                required
                value={fechaVisita}
                onChange={(e) => setFechaVisita(e.target.value)}
              />
            </div>

            <Button type="submit" fullWidth isPending={crearVisitaMutation.isPending}>
              Registrar Visita
            </Button>
          </form>
        </SectionCard>

        <SectionCard className="lg:col-span-3" titulo="Visitas registradas">
          {visitasQuery.isLoading ? (
            <ListSkeleton label="Cargando visitas..." forma="tabla" />
          ) : (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Visitas registradas" className="min-w-[620px]">
                  <Table.Header>
                    <Table.Column isRowHeader>Institución</Table.Column>
                    <Table.Column>Responsable</Table.Column>
                    <Table.Column>Personas</Table.Column>
                    <Table.Column>Fecha</Table.Column>
                    <Table.Column>Total</Table.Column>
                    <Table.Column>Estado</Table.Column>
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={() => <EmptyMessage>Aún no hay visitas institucionales registradas.</EmptyMessage>}
                  >
                    {visitas.map((visita) => (
                      <Table.Row key={visita.id} id={visita.id}>
                        <Table.Cell className="font-medium text-foreground">{visita.institucion_nombre}</Table.Cell>
                        <Table.Cell>{visita.responsable_nombre}</Table.Cell>
                        <Table.Cell className="tabular-nums">{visita.cantidad_personas}</Table.Cell>
                        <Table.Cell>{fechaCorta(visita.fecha_visita)}</Table.Cell>
                        <Table.Cell className="tabular-nums">{currencyFormatter.format(visita.total_a_cobrar)}</Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft" color="warning" className="capitalize">
                            {visita.estado}
                          </Chip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
