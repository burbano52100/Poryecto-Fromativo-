import { useMemo, useState } from 'react';
import { Award, UserCheck, Users, UserX } from 'lucide-react';
import { Alert, Avatar, Chip, CloseButton, Table, Tabs } from '@heroui/react';
import {
  useEstudiantesQuery,
  useToggleBeneficiarioMutation,
  type EstudianteBeneficiario,
} from '../../hooks/useBeneficiarios';
import { Button } from '../atoms/Button';
import { StatCard } from '../atoms/StatCard';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { EmptyMessage } from '../molecules/EmptyMessage';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { SearchInput } from '../molecules/SearchInput';
import { SectionCard } from '../molecules/SectionCard';
import { SelectField } from '../molecules/SelectField';
import { iniciales } from '../../lib/usuario';

export const BeneficiariosSection = () => {
  // Tab selector: 'todos' | 'actuales'
  const [activeTab, setActiveTab] = useState<'todos' | 'actuales'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [fichaFilter, setFichaFilter] = useState<string>('todas');

  // Modal para confirmar revocación / quitar beneficio
  const [studentToRevoke, setStudentToRevoke] = useState<EstudianteBeneficiario | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<unknown>(null);

  const { data: estudiantes = [], isLoading, isError, error, refetch } = useEstudiantesQuery();
  const toggleMutation = useToggleBeneficiarioMutation();

  // Fichas únicas para el select de filtro
  const fichasDisponibles = useMemo(() => {
    const fichasSet = new Set<string>();
    estudiantes.forEach((est) => {
      if (est.ficha) fichasSet.add(est.ficha);
    });
    return Array.from(fichasSet).sort();
  }, [estudiantes]);

  // Beneficiarios actuales
  const beneficiariosActuales = useMemo(() => {
    return estudiantes.filter((est) => est.es_beneficiario);
  }, [estudiantes]);

  // Filtrado de la lista según la pestaña activa, término de búsqueda y ficha
  const listadoFiltrado = useMemo(() => {
    const baseList = activeTab === 'todos' ? estudiantes : beneficiariosActuales;

    return baseList.filter((est) => {
      const matchSearch =
        est.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        est.document.includes(searchTerm) ||
        est.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        est.ficha.includes(searchTerm);

      const matchFicha = fichaFilter === 'todas' || est.ficha === fichaFilter;

      return matchSearch && matchFicha;
    });
  }, [activeTab, estudiantes, beneficiariosActuales, searchTerm, fichaFilter]);

  // Acción: Agregar como beneficiario
  const handleAddBeneficiario = (student: EstudianteBeneficiario) => {
    toggleMutation.mutate(
      { usuarioId: student.id, es_beneficiario: true },
      {
        onError: setMutationError,
        onSuccess: (res) => {
          setMutationError(null);
          setFeedbackMessage(res.message);
          setTimeout(() => setFeedbackMessage(null), 4000);
        },
      }
    );
  };

  // Acción: Confirmar y Quitar beneficiario
  const handleConfirmRevoke = () => {
    if (!studentToRevoke) return;

    toggleMutation.mutate(
      { usuarioId: studentToRevoke.id, es_beneficiario: false },
      {
        onError: (err) => {
          setMutationError(err);
          setStudentToRevoke(null);
        },
        onSuccess: (res) => {
          setMutationError(null);
          setFeedbackMessage(res.message);
          setStudentToRevoke(null);
          setTimeout(() => setFeedbackMessage(null), 4000);
        },
      }
    );
  };

  const tabla = isLoading ? (
    <ListSkeleton label="Cargando aprendices..." />
  ) : isError ? (
    <ErrorAlert error={error} titulo="No se pudo cargar la lista de aprendices" onReintentar={() => refetch()} />
  ) : (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Aprendices y estado del beneficio" className="min-w-[760px]">
          <Table.Header>
            <Table.Column isRowHeader>Aprendiz</Table.Column>
            <Table.Column>Documento y ficha</Table.Column>
            <Table.Column>Correo</Table.Column>
            <Table.Column>Beneficio</Table.Column>
            <Table.Column className="text-right">Acción</Table.Column>
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <EmptyMessage>No se encontraron aprendices. Prueba con otra búsqueda o ficha.</EmptyMessage>
            )}
          >
            {listadoFiltrado.map((student) => (
              <Table.Row key={student.id} id={student.id}>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm" variant="soft" color={student.es_beneficiario ? 'warning' : 'default'}>
                      <Avatar.Fallback>{iniciales(student.name)}</Avatar.Fallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{student.name}</span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="tabular-nums">{student.document}</span>
                  <span className="block text-xs text-muted">Ficha {student.ficha || 'sin asignar'}</span>
                </Table.Cell>
                <Table.Cell className="text-xs">{student.email}</Table.Cell>
                <Table.Cell>
                  {student.es_beneficiario ? (
                    <Chip size="sm" variant="soft" color="warning">
                      <Award className="size-3.5" />
                      <Chip.Label>Beneficiario ($0)</Chip.Label>
                    </Chip>
                  ) : (
                    <Chip size="sm" variant="soft">
                      Tarifa regular
                    </Chip>
                  )}
                </Table.Cell>
                <Table.Cell className="text-right">
                  {student.es_beneficiario ? (
                    <Button
                      size="sm"
                      variant="danger-soft"
                      onPress={() => setStudentToRevoke(student)}
                      isDisabled={toggleMutation.isPending}
                    >
                      <UserX />
                      Quitar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => handleAddBeneficiario(student)}
                      isDisabled={toggleMutation.isPending}
                    >
                      <Award />
                      Agregar como beneficiario
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );

  return (
    <div className="flex flex-col gap-6">
      {feedbackMessage && (
        <Alert status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{feedbackMessage}</Alert.Description>
          </Alert.Content>
          <CloseButton aria-label="Cerrar aviso" onPress={() => setFeedbackMessage(null)} />
        </Alert>
      )}

      {mutationError !== null && (
        <ErrorAlert error={mutationError} titulo="No se pudo actualizar el beneficio" onCerrar={() => setMutationError(null)} />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Beneficiarios activos"
          value={isLoading ? undefined : beneficiariosActuales.length}
          icon={<Award className="size-5" />}
          tone="warning"
        />
        <StatCard
          title="Aprendices registrados"
          value={isLoading ? undefined : estudiantes.length}
          icon={<Users className="size-5" />}
          tone="accent"
        />
        <StatCard
          title="Tarifa con subsidio"
          value="$0"
          subtitle="Almuerzo 100 % gratis"
          icon={<UserCheck className="size-5" />}
          tone="success"
        />
      </div>

      <SectionCard
        titulo="Beneficiarios del subsidio"
        descripcion="Los beneficiarios reservan con un clic y no se les cobra el almuerzo."
      >
        <Tabs
          variant="secondary"
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as 'todos' | 'actuales')}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Vista de aprendices">
              <Tabs.Tab id="todos">
                Todos los aprendices
                <Chip size="sm" variant="soft" className="ml-1.5">
                  {estudiantes.length}
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="actuales">
                Beneficiarios actuales
                <Chip size="sm" variant="soft" color="warning" className="ml-1.5">
                  {beneficiariosActuales.length}
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            <SearchInput
              label="Buscar aprendiz"
              placeholder="Buscar por nombre, cédula o ficha..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="flex-1"
            />
            <SelectField
              label="Filtrar por ficha"
              ocultarLabel
              className="sm:w-52"
              value={fichaFilter}
              onChange={(v) => setFichaFilter(v || 'todas')}
              opciones={[
                { id: 'todas', label: 'Todas las fichas' },
                ...fichasDisponibles.map((f) => ({ id: f, label: `Ficha ${f}` })),
              ]}
            />
          </div>

          <Tabs.Panel id="todos" className="pt-4">
            {tabla}
          </Tabs.Panel>
          <Tabs.Panel id="actuales" className="pt-4">
            {tabla}
          </Tabs.Panel>
        </Tabs>
      </SectionCard>

      <ConfirmDialog
        abierto={studentToRevoke !== null}
        titulo="¿Quitar como Beneficiario?"
        variante="warning"
        textoConfirmar="Sí, quitar beneficio"
        onConfirmar={handleConfirmRevoke}
        onCancelar={() => setStudentToRevoke(null)}
        cargando={toggleMutation.isPending}
      >
        {studentToRevoke && (
          <div className="flex flex-col gap-3">
            <p>
              <span className="font-medium text-foreground">{studentToRevoke.name}</span> (C.C.{' '}
              {studentToRevoke.document}, ficha {studentToRevoke.ficha}) dejará de tener el almuerzo subsidiado.
            </p>
            <p>
              El precio vuelve a la tarifa regular desde su{' '}
              <span className="font-medium text-foreground">siguiente reserva</span>; las reservas ya hechas con
              subsidio no cambian.
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};
