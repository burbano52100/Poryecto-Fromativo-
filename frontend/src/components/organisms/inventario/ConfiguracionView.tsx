import { Alert, Chip, Separator } from '@heroui/react';
import { Fragment } from 'react';
import { SectionCard } from '../../molecules/SectionCard';

/**
 * Reglas con las que el backend calcula el estado de cada material
 * (ESTADO_MATERIAL_SQL en backend/src/services/inventario.service.ts). Solo lectura.
 */
const REGLAS = [
  { estado: 'Venciendo', color: 'danger', regla: 'Vence en 5 días o menos (hora de Colombia). Tiene prioridad sobre las demás.' },
  { estado: 'Crítico', color: 'danger', regla: 'Stock actual igual o menor al 50 % del stock mínimo.' },
  { estado: 'Bajo', color: 'warning', regla: 'Stock actual igual o menor al stock mínimo.' },
  { estado: 'Bueno', color: 'success', regla: 'Por encima del stock mínimo y sin vencimiento cercano.' },
] as const;

export const ConfiguracionView = () => (
  <SectionCard titulo="Configuración de inventario" descripcion="Cómo se calcula el estado de cada material en Control de stock">
    <ul className="rounded-xl bg-surface-secondary">
      {REGLAS.map(({ estado, color, regla }, i) => (
        <Fragment key={estado}>
          {i > 0 && <Separator />}
          <li className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <Chip size="sm" variant="soft" color={color} className="w-24 justify-center">
              {estado}
            </Chip>
            <span className="min-w-[200px] flex-1 text-foreground">{regla}</span>
          </li>
        </Fragment>
      ))}
    </ul>

    <Alert status="accent">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>
          El stock mínimo se define por material al crearlo. Las notificaciones automáticas de reposición todavía no
          están implementadas.
        </Alert.Description>
      </Alert.Content>
    </Alert>
  </SectionCard>
);
