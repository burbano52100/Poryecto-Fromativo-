import { Chip } from '@heroui/react';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { ListSkeleton } from '../molecules/ListSkeleton';
import { useMateriales, useRecetas } from '../../hooks/useInventario';

interface IngredientesADescontarProps {
  recetaId: string;
  /** Porciones que se van a ofrecer: con ellas se calcula cuánto hace falta en bodega. */
  porciones: number;
}

const cantidad = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

/**
 * Qué descuenta del inventario cada almuerzo vendido con esta receta (ADR 020) y si la bodega
 * alcanza para todas las porciones del menú. El descuento lo hace el backend en cada venta; esto
 * es solo para revisar antes de publicar.
 */
export const IngredientesADescontar = ({ recetaId, porciones }: IngredientesADescontarProps) => {
  const recetas = useRecetas();
  const materiales = useMateriales();

  if (recetas.isPending || materiales.isPending) return <ListSkeleton label="Cargando ingredientes..." filas={2} />;
  if (recetas.isError) {
    return <ErrorAlert error={recetas.error} titulo="No se pudieron cargar los ingredientes" onReintentar={() => recetas.refetch()} />;
  }

  const receta = recetas.data.find((r) => r.id === recetaId);
  if (!receta) return null;
  if (receta.ingredients.length === 0) {
    return (
      <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning-soft-foreground">
        La receta "{receta.name}" no tiene ingredientes: no descontará nada. Agrégalos en Inventario, Recetas y productos.
      </p>
    );
  }

  const stockDe = new Map((materiales.data ?? []).map((m) => [m.id, m.stock]));
  const filas = receta.ingredients.map((ing) => {
    const necesario = ing.cantidad * porciones;
    const enBodega = stockDe.get(ing.material_id) ?? 0;
    return { ...ing, necesario, enBodega, faltante: Math.max(necesario - enBodega, 0) };
  });
  const conFaltante = filas.filter((f) => f.faltante > 0).length;

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Cada almuerzo vendido descuenta del inventario</p>
        {porciones > 0 &&
          (conFaltante > 0 ? (
            <Chip size="sm" variant="soft" color="danger">
              Falta {conFaltante === 1 ? '1 ingrediente' : `${conFaltante} ingredientes`} para {porciones} porciones
            </Chip>
          ) : (
            <Chip size="sm" variant="soft" color="success">
              Alcanza para {porciones} porciones
            </Chip>
          ))}
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Ingredientes de la receta {receta.name}</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="py-1.5 font-normal">Ingrediente</th>
            <th scope="col" className="py-1.5 text-right font-normal">Por almuerzo</th>
            <th scope="col" className="py-1.5 text-right font-normal">Para {porciones} porciones</th>
            <th scope="col" className="py-1.5 text-right font-normal">En bodega</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {filas.map((f) => (
            <tr key={f.material_id}>
              <th scope="row" className="py-2 text-left font-medium text-foreground">
                {f.item}
              </th>
              <td className="py-2 text-right tabular-nums text-muted">
                {cantidad(f.cantidad)} {f.unidad}
              </td>
              <td className="py-2 text-right tabular-nums text-foreground">
                {cantidad(f.necesario)} {f.unidad}
              </td>
              <td className={`py-2 text-right tabular-nums ${f.faltante > 0 ? 'font-medium text-danger-soft-foreground' : 'text-foreground'}`}>
                {cantidad(f.enBodega)} {f.unidad}
                {f.faltante > 0 && <span className="block text-xs">faltan {cantidad(f.faltante)}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
