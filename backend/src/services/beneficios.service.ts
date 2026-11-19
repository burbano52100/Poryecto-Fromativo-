import type pg from 'pg';
import { pool } from '../db/index.js';
import type { AuthenticatedUser } from '../middleware/auth.middleware.js';
import { registrarAuditoria } from './auditoria.service.js';
import { crearAlerta } from './alertas.service.js';
import { obtenerConfiguracion } from './configuracion.service.js';

/**
 * Beneficios de almuerzo a $0 (ADR 019): cupo máximo de activos, lista de espera por prioridad
 * (1 = la más alta) y fecha, y fin con motivo. usuarios.es_beneficiario lo sincroniza un trigger.
 */
type Queryable = Pick<pg.PoolClient, 'query'>;
type Usuario = Pick<AuthenticatedUser, 'id' | 'name' | 'role'> | null | undefined;

export const MOTIVOS_FIN = {
  fecha_cumplida: 'Cumplió la fecha de fin',
  retiro: 'Retiro del aprendiz',
  inasistencias: 'Inasistencias',
  mal_uso: 'Mal uso del apoyo',
  informacion_falsa: 'Información falsa',
  cuenta_desactivada: 'Cuenta desactivada por el Coordinador',
  ficha_finalizada: 'Ficha finalizada',
  otro: 'Otro',
} as const;

export type MotivoFin = keyof typeof MOTIVOS_FIN;
/** Motivos que el encargado puede elegir; los demás los pone el sistema. */
export const MOTIVOS_FIN_MANUALES = ['retiro', 'inasistencias', 'mal_uso', 'informacion_falsa', 'otro'] as const;

/** Orden de la lista de espera: prioridad (1 primero) y luego quien llegó antes. */
export const ORDEN_ESPERA = 'b.prioridad ASC, b.created_at ASC';

export async function estadoCupo(db: Queryable = pool): Promise<{ cupo: number; activos: number; disponibles: number }> {
  const { beneficiarios_cupo_maximo: cupo } = await obtenerConfiguracion(db);
  const res = await db.query("SELECT COUNT(*)::int AS n FROM beneficios WHERE estado = 'activo';");
  const activos = res.rows[0].n as number;
  return { cupo, activos, disponibles: Math.max(cupo - activos, 0) };
}

/** Primero de la lista de espera (o null). */
export async function primeroEnEspera(db: Queryable = pool) {
  const res = await db.query(
    `SELECT b.id, b.usuario_id, u.nombre, u.cedula, b.prioridad
     FROM beneficios b JOIN usuarios u ON u.id = b.usuario_id
     WHERE b.estado = 'en_espera' AND u.estado = 'activo'
     ORDER BY ${ORDEN_ESPERA}
     LIMIT 1;`
  );
  return res.rows[0] ?? null;
}

/** Si se liberó un cupo y hay lista de espera, avisa al encargado a quién sugiere el sistema. */
async function avisarCupoLiberado(db: Queryable): Promise<void> {
  const { disponibles } = await estadoCupo(db);
  if (disponibles === 0) return;
  const siguiente = await primeroEnEspera(db);
  if (!siguiente) return;
  await crearAlerta(
    'cupo_liberado',
    `Se liberó un cupo de beneficiario. El primero de la lista de espera es ${siguiente.nombre} (C.C. ${siguiente.cedula}): confírmalo en Beneficiarios.`,
    { beneficioId: siguiente.id, usuarioId: siguiente.usuario_id },
    db
  );
}

/** Finaliza un beneficio vigente con su motivo, lo audita y, si era activo, avisa del cupo liberado. */
export async function finalizarBeneficio(
  db: Queryable,
  { beneficioId, motivo, detalle, usuario }: { beneficioId: string; motivo: MotivoFin; detalle?: string | null; usuario: Usuario }
) {
  const res = await db.query(
    `UPDATE beneficios b
     SET estado = 'finalizado', motivo_fin = $2, detalle_fin = $3, fecha_finalizacion = NOW(), finalizado_por = $4
     FROM (SELECT id, estado FROM beneficios WHERE id = $1 FOR UPDATE) anterior
     WHERE b.id = anterior.id AND anterior.estado <> 'finalizado'
     RETURNING b.id, b.usuario_id, anterior.estado AS estado_anterior;`,
    [beneficioId, motivo, detalle ?? null, usuario?.id ?? null]
  );
  const fila = res.rows[0];
  if (!fila) return null;
  await registrarAuditoria(
    {
      usuario,
      accion: 'finalizar',
      entidad: 'beneficio',
      entidadId: fila.id,
      antes: { estado: fila.estado_anterior },
      despues: { estado: 'finalizado', motivo, detalle: detalle ?? null },
    },
    db
  );
  if (fila.estado_anterior === 'activo') await avisarCupoLiberado(db);
  return fila as { id: string; usuario_id: string; estado_anterior: string };
}

/**
 * Cuando un aprendiz deja de poder recibir el beneficio (cuenta desactivada o ficha finalizada),
 * finaliza su beneficio vigente y avisa al encargado.
 */
export async function finalizarBeneficiosDeUsuarios(
  db: Queryable,
  usuarioIds: string[],
  motivo: 'cuenta_desactivada' | 'ficha_finalizada',
  usuario: Usuario
): Promise<number> {
  if (usuarioIds.length === 0) return 0;
  const vigentes = await db.query(
    `SELECT b.id, b.estado, u.nombre, u.cedula
     FROM beneficios b JOIN usuarios u ON u.id = b.usuario_id
     WHERE b.usuario_id = ANY($1::uuid[]) AND b.estado <> 'finalizado';`,
    [usuarioIds]
  );
  for (const b of vigentes.rows) {
    await finalizarBeneficio(db, { beneficioId: b.id, motivo, usuario });
    await crearAlerta(
      'beneficiario_inactivo',
      `${b.nombre} (C.C. ${b.cedula}) dejó de ser beneficiario: ${MOTIVOS_FIN[motivo].toLowerCase()}.`,
      { beneficioId: b.id, motivo },
      db
    );
  }
  return vigentes.rows.length;
}

/**
 * Finaliza los beneficios activos cuya fecha de fin ya pasó (la fecha de fin es el último día con
 * beneficio). Se llama al consultar beneficiarios, el menú o al reservar, y cada hora.
 */
export async function finalizarBeneficiosVencidos(db: Queryable = pool): Promise<number> {
  const vencidos = await db.query(
    `SELECT b.id, u.nombre, u.cedula, TO_CHAR(b.fecha_fin, 'DD/MM/YYYY') AS fin
     FROM beneficios b JOIN usuarios u ON u.id = b.usuario_id
     WHERE b.estado = 'activo' AND b.fecha_fin < (NOW() AT TIME ZONE 'America/Bogota')::date;`
  );
  for (const b of vencidos.rows) {
    const fila = await finalizarBeneficio(db, { beneficioId: b.id, motivo: 'fecha_cumplida', usuario: null });
    if (fila) {
      await crearAlerta(
        'beneficio_finalizado',
        `Terminó el beneficio de ${b.nombre} (C.C. ${b.cedula}): su fecha de fin era el ${b.fin}.`,
        { beneficioId: b.id },
        db
      );
    }
  }
  return vencidos.rows.length;
}
