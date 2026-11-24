import { useState } from 'react';
import { Chip, Tabs, toast } from '@heroui/react';
import { Ban, HandCoins, PackageCheck } from 'lucide-react';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { EmptyMessage } from '../molecules/EmptyMessage';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { FranjaCifras } from '../molecules/FranjaCifras';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { SectionCard } from '../molecules/SectionCard';
import { RegistroAlmuerzoEspecialCard } from './almuerzosEspeciales/RegistroAlmuerzoEspecialCard';
import { PedidoEspecialItem } from './almuerzosEspeciales/PedidoEspecialItem';
import {
  useAlmuerzosEspeciales,
  useCambiarAlmuerzoEspecial,
  useResumenAlmuerzosEspeciales,
} from '../../hooks/useAlmuerzosEspeciales';
import { fechaCorta, pesos } from '../../lib/formato';
import type { AlmuerzoEspecial } from '../../types/api';

type Vista = 'programados' | 'porCobrar' | 'historial';
type Accion = 'entregado' | 'pagado' | 'cancelado';

const VACIO: Record<Vista, string> = {
  programados: 'No hay almuerzos especiales programados.',
  porCobrar: 'Ningún contrato tiene almuerzos por cobrar.',
  historial: 'Aún no hay almuerzos especiales pagados ni cancelados.',
};

/**
 * Almuerzos especiales (ADR 024): pedidos de Bienestar al Aprendiz, la Regional o Dirección General
 * con un menú distinto y un precio propio, casi siempre por contrato. Registrar va primero; al lado,
 * los pedidos según lo que falta hacer con ellos.
 */
export const AlmuerzosEspecialesSection = () => {
  const pedidos = useAlmuerzosEspeciales();
  const resumen = useResumenAlmuerzosEspeciales();
  const cambiar = useCambiarAlmuerzoEspecial();
  const [vista, setVista] = useState<Vista>('programados');
  const [pendiente, setPendiente] = useState<{ pedido: AlmuerzoEspecial; accion: Accion } | null>(null);

  const todos = pedidos.data ?? [];
  // Los programados, del más próximo al más lejano; lo demás, del más reciente al más antiguo
  const grupos: Record<Vista, AlmuerzoEspecial[]> = {
    programados: todos.filter((p) => p.estado === 'programado').sort((a, b) => a.fecha.localeCompare(b.fecha)),
    porCobrar: todos.filter((p) => p.estado === 'entregado' && !p.pagado),
    historial: todos.filter((p) => p.pagado || p.estado === 'cancelado'),
  };

  const abrir = (accion: Accion) => (pedido: AlmuerzoEspecial) => {
    cambiar.reset();
    setPendiente({ pedido, accion });
  };

  const confirmar = () => {
    if (!pendiente) return;
    const { pedido, accion } = pendiente;
    cambiar.mutate(
      { id: pedido.id, accion },
      {
        onSuccess: (actualizado) => {
          setPendiente(null);
          if (accion === 'entregado') {
            toast.success(`Almuerzo especial de ${pedido.solicitante} entregado`);
            for (const aviso of actualizado.avisos_inventario ?? []) toast.warning(aviso);
            setVista('porCobrar');
          } else if (accion === 'pagado') {
            toast.success(`Pago de ${pesos(pedido.total)} registrado: ya cuenta en Ventas`);
          } else {
            toast.success(`Almuerzo especial de ${pedido.solicitante} cancelado`);
          }
        },
      }
    );
  };

  const dialogo = pendiente && {
    entregado: {
      titulo: 'Marcar como entregado',
      icono: <PackageCheck className="size-5" />,
      textoConfirmar: 'Marcar entregado',
      variante: 'accent' as const,
      texto: pendiente.pedido.receta_nombre
        ? `Se descuentan de la bodega los ingredientes de "${pendiente.pedido.receta_nombre}" para ${pendiente.pedido.cantidad_personas} personas.`
        : 'El pedido no tiene receta: no se descontará nada de la bodega.',
    },
    pagado: {
      titulo: 'Registrar pago del contrato',
      icono: <HandCoins className="size-5" />,
      textoConfirmar: `Registrar ${pesos(pendiente.pedido.total)}`,
      variante: 'accent' as const,
      texto: `${pendiente.pedido.solicitante} pagó ${pesos(pendiente.pedido.total)}. Desde hoy cuenta en Ventas.`,
    },
    cancelado: {
      titulo: 'Cancelar almuerzo especial',
      icono: <Ban className="size-5" />,
      textoConfirmar: 'Cancelar pedido',
      variante: 'danger' as const,
      texto: `El pedido de ${pendiente.pedido.solicitante} para el ${fechaCorta(pendiente.pedido.fecha)} queda cancelado. No se puede deshacer.`,
    },
  }[pendiente.accion];

  return (
    <div className="flex flex-col gap-6">
      <FranjaCifras
        etiqueta="Resumen de almuerzos especiales"
        destacada
        cifras={[
          {
            etiqueta: 'Por cobrar a contratos',
            valor: resumen.data ? pesos(resumen.data.porCobrar.monto) : undefined,
            detalle: resumen.data
              ? `${resumen.data.porCobrar.cantidad} ${resumen.data.porCobrar.cantidad === 1 ? 'pedido entregado' : 'pedidos entregados'} sin pagar`
              : undefined,
          },
          { etiqueta: 'Programados', valor: resumen.data?.programados, detalle: 'Por cocinar y entregar' },
          { etiqueta: 'Cobrado este mes', valor: resumen.data ? pesos(resumen.data.cobradoMes) : undefined },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        <RegistroAlmuerzoEspecialCard className="lg:col-span-2" />

        <SectionCard className="lg:col-span-3" titulo="Pedidos" descripcion="Cada pedido con lo que falta: entregarlo o cobrarlo">
          {pedidos.isPending ? (
            <ListSkeleton label="Cargando almuerzos especiales..." />
          ) : pedidos.isError ? (
            <ErrorAlert error={pedidos.error} titulo="No se pudieron cargar los almuerzos especiales" onReintentar={() => pedidos.refetch()} />
          ) : (
            <Tabs variant="secondary" selectedKey={vista} onSelectionChange={(key) => setVista(key as Vista)}>
              <Tabs.ListContainer>
                <Tabs.List aria-label="Pedidos por estado">
                  {(
                    [
                      ['programados', 'Programados', 'accent'],
                      ['porCobrar', 'Por cobrar', 'warning'],
                      ['historial', 'Historial', 'default'],
                    ] as const
                  ).map(([id, etiqueta, color]) => (
                    <Tabs.Tab key={id} id={id}>
                      {etiqueta}
                      {id !== 'historial' && grupos[id].length > 0 && (
                        <Chip size="sm" variant="soft" color={color} className="ml-1.5">
                          {grupos[id].length}
                        </Chip>
                      )}
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
              {(['programados', 'porCobrar', 'historial'] as const).map((id) => (
                <Tabs.Panel key={id} id={id} className="flex flex-col gap-3 pt-4">
                  {grupos[id].length === 0 ? (
                    <EmptyMessage>{VACIO[id]}</EmptyMessage>
                  ) : (
                    grupos[id].map((pedido) => (
                      <PedidoEspecialItem
                        key={pedido.id}
                        pedido={pedido}
                        onEntregar={abrir('entregado')}
                        onPagar={abrir('pagado')}
                        onCancelar={abrir('cancelado')}
                      />
                    ))
                  )}
                </Tabs.Panel>
              ))}
            </Tabs>
          )}
        </SectionCard>
      </div>

      {dialogo && (
        <ConfirmDialog
          abierto
          titulo={dialogo.titulo}
          icono={dialogo.icono}
          textoConfirmar={dialogo.textoConfirmar}
          variante={dialogo.variante}
          cargando={cambiar.isPending}
          onConfirmar={confirmar}
          onCancelar={() => setPendiente(null)}
        >
          <div className="flex flex-col gap-3">
            <p>{dialogo.texto}</p>
            {cambiar.isError && <ErrorAlert error={cambiar.error} titulo="No se pudo actualizar el pedido" />}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
};
