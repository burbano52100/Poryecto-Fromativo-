import type { InventarioSubSection } from './Sidebar';
import { StockView } from './inventario/StockView';
import { RecetasView } from './inventario/RecetasView';
import { KardexView } from './inventario/KardexView';
import { MermasView } from './inventario/MermasView';
import { ConfiguracionView } from './inventario/ConfiguracionView';

export interface InventarioSectionProps {
  activeSubSection?: InventarioSubSection;
}

/** Inventario del Encargado: cinco sub-vistas conectadas a /api/inventario. */
export const InventarioSection = ({ activeSubSection = 'stock' }: InventarioSectionProps) => (
  <div className="space-y-6">
    {activeSubSection === 'stock' && <StockView />}
    {activeSubSection === 'recetas' && <RecetasView />}
    {activeSubSection === 'kardex' && <KardexView />}
    {activeSubSection === 'mermas' && <MermasView />}
    {activeSubSection === 'configuracion' && <ConfiguracionView />}
  </div>
);
