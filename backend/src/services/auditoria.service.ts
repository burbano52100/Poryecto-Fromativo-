import type pg from 'pg';
import { pool } from '../db/index.js';
import type { AuthenticatedUser } from '../middleware/auth.middleware.js';

/**
 * Registro de auditoría (ADR 017): quién hizo qué, sobre qué entidad, y los datos antes y
 * después. La tabla es de solo inserción (triggers en la migración 009).
 * Se llama dentro de la misma transacción que el cambio, para que ambos queden o ninguno.
 */
export type AccionAuditoria =
  | 'crear'
  | 'editar'
  | 'eliminar'
  | 'cambiar_estado'
  | 'aprobar'
  | 'rechazar'
  | 'activar'
  | 'desactivar'
  | 'restablecer_clave'
  | 'cambiar_clave'
  | 'cargar'
  | 'pagar'
  | 'cerrar'
  | 'reabrir'
  | 'enviar'
  | 'omitir'
  | 'finalizar'
  | 'promover'
  | 'descontar'
  | 'revertir'
  | 'configurar'
  | 'marcar_realizada'
  | 'marcar_entregado'
  | 'cancelar'
  | 'calificar';

export type EntidadAuditoria =
  | 'menu_dia'
  | 'almuerzo_invitado'
  | 'almuerzo_especial'
  | 'venta'
  | 'pago_deuda'
  | 'beneficio'
  | 'material'
  | 'movimiento_inventario'
  | 'merma'
  | 'receta'
  | 'cierre_caja'
  | 'recordatorio_deuda'
  | 'cuenta'
  | 'ficha'
  | 'carga_masiva'
  | 'configuracion'
  | 'visita'
  | 'calificacion';

export interface RegistroAuditoria {
  /** null para las acciones automáticas del sistema (p. ej. un beneficio que vence). */
  usuario: Pick<AuthenticatedUser, 'id' | 'name' | 'role'> | null | undefined;
  accion: AccionAuditoria;
  entidad: EntidadAuditoria;
  entidadId?: string | null;
  antes?: unknown;
  despues?: unknown;
}

type Queryable = Pick<pg.PoolClient, 'query'>;

const json = (valor: unknown) => (valor === undefined || valor === null ? null : JSON.stringify(valor));

export async function registrarAuditoria(registro: RegistroAuditoria, db: Queryable = pool): Promise<void> {
  const { usuario } = registro;
  await db.query(
    `INSERT INTO auditoria (usuario_id, usuario_nombre, rol, accion, entidad, entidad_id, datos_antes, datos_despues)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb);`,
    [
      usuario?.id ?? null,
      usuario?.name ?? 'Sistema',
      usuario?.role ?? 'sistema',
      registro.accion,
      registro.entidad,
      registro.entidadId ?? null,
      json(registro.antes),
      json(registro.despues),
    ]
  );
}
