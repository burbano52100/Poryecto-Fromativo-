import { pool } from '../db/index.js';
import type { AuthenticatedUser } from '../middleware/auth.middleware.js';
import { registrarAuditoria } from './auditoria.service.js';
import { enviarCorreo, escaparHtml, type Correo } from './correo.service.js';

/**
 * Recordatorios de deuda a instructores (ADR 023): como máximo uno enviado por instructor cada
 * 24 horas. Se omite a quien no tiene correo o ya recibió uno; todo queda en recordatorios_deuda
 * (enviado, fallido u omitido) y en la auditoría.
 */
export const HORAS_ENTRE_RECORDATORIOS = 24;

type Usuario = Pick<AuthenticatedUser, 'id' | 'name' | 'role'>;

export interface DeudaInstructor {
  instructor_id: string;
  deuda_id: string;
  nombre: string;
  email: string | null;
  monto: number;
  almuerzos: number;
  dias_vencidos: number;
}

export interface ResultadoRecordatorio {
  instructor_id: string;
  nombre: string;
  estado: 'enviado' | 'fallido' | 'omitido';
  modo_prueba: boolean;
  motivo: string | null;
}

const pesos = (valor: number) => `$${Math.round(valor).toLocaleString('es-CO')}`;

/** Plantilla en español del recordatorio. */
export function plantillaRecordatorio(d: DeudaInstructor): Correo {
  const almuerzos = `${d.almuerzos} almuerzo${d.almuerzos === 1 ? '' : 's'}`;
  const dias = `${d.dias_vencidos} día${d.dias_vencidos === 1 ? '' : 's'}`;
  const texto = [
    `Hola, ${d.nombre}:`,
    '',
    `Te recordamos que tienes un saldo pendiente en el comedor de ${pesos(d.monto)}, correspondiente a ${almuerzos}.`,
    `La deuda lleva ${dias} desde su primer consumo sin pagar.`,
    '',
    'Puedes cancelarla en efectivo en la oficina del comedor del Tecnoparque Yamboró.',
    'Si ya realizaste el pago, por favor ignora este mensaje.',
    '',
    'Gracias,',
    'Comedor del SENA Tecnoparque Yamboró (SARA)',
  ].join('\n');
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 560px">
      <h2 style="color: #308b57">Recordatorio de pago</h2>
      <p>Hola, <strong>${escaparHtml(d.nombre)}</strong>:</p>
      <p>Te recordamos que tienes un saldo pendiente en el comedor de
        <strong>${pesos(d.monto)}</strong>, correspondiente a <strong>${almuerzos}</strong>.</p>
      <p>La deuda lleva <strong>${dias}</strong> desde su primer consumo sin pagar.</p>
      <p>Puedes cancelarla en efectivo en la oficina del comedor del Tecnoparque Yamboró.
        Si ya realizaste el pago, por favor ignora este mensaje.</p>
      <p style="color: #6b7280">Comedor del SENA Tecnoparque Yamboró (SARA)</p>
    </div>`;
  return { para: d.email ?? '', asunto: `Recordatorio: saldo pendiente de ${pesos(d.monto)} en el comedor`, texto, html };
}

/** Instructores con deuda pendiente (todos o los indicados). */
export async function instructoresConDeuda(ids?: string[]): Promise<DeudaInstructor[]> {
  const res = await pool.query(
    `SELECT u.id AS instructor_id, d.id AS deuda_id, u.nombre, NULLIF(BTRIM(u.email), '') AS email,
            d.monto::float8 AS monto, d.almuerzos_pendientes AS almuerzos,
            GREATEST(((NOW() AT TIME ZONE 'America/Bogota')::date - d.fecha_origen)::int, 0) AS dias_vencidos
     FROM deudas d
     JOIN usuarios u ON u.id = d.usuario_id
     WHERE d.estado <> 'pagada' AND d.monto > 0 AND u.rol = 'instructor'
       AND ($1::uuid[] IS NULL OR u.id = ANY($1::uuid[]))
     ORDER BY u.nombre;`,
    [ids ?? null]
  );
  return res.rows;
}

/** Envía (u omite) el recordatorio de cada instructor con deuda y deja el historial. */
export async function enviarRecordatorios(deudas: DeudaInstructor[], usuario: Usuario): Promise<ResultadoRecordatorio[]> {
  const resultados: ResultadoRecordatorio[] = [];
  for (const d of deudas) {
    let estado: ResultadoRecordatorio['estado'];
    let motivo: string | null = null;
    let modoPrueba = false;

    const reciente = await pool.query(
      `SELECT TO_CHAR(fecha_hora AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH12:MI AM') AS cuando
       FROM recordatorios_deuda
       WHERE instructor_id = $1 AND estado = 'enviado'
         AND fecha_hora > NOW() - make_interval(hours => $2)
       ORDER BY fecha_hora DESC LIMIT 1;`,
      [d.instructor_id, HORAS_ENTRE_RECORDATORIOS]
    );

    if (!d.email) {
      estado = 'omitido';
      motivo = 'No tiene correo registrado.';
    } else if (reciente.rows[0]) {
      estado = 'omitido';
      motivo = `Ya recibió un recordatorio en las últimas ${HORAS_ENTRE_RECORDATORIOS} horas (${reciente.rows[0].cuando}).`;
    } else {
      try {
        modoPrueba = (await enviarCorreo(plantillaRecordatorio(d))).modoPrueba;
        estado = 'enviado';
      } catch (error) {
        estado = 'fallido';
        motivo = `No se pudo enviar el correo: ${error instanceof Error ? error.message : 'error desconocido'}`.slice(0, 300);
      }
    }

    const fila = await pool.query(
      `INSERT INTO recordatorios_deuda (instructor_id, deuda_id, canal, estado, modo_prueba, destinatario, monto, error, enviado_por)
       VALUES ($1, $2, 'correo', $3, $4, $5, $6, $7, $8) RETURNING id;`,
      [d.instructor_id, d.deuda_id, estado, modoPrueba, d.email, d.monto, motivo, usuario.id]
    );
    await registrarAuditoria({
      usuario,
      accion: estado === 'omitido' ? 'omitir' : 'enviar',
      entidad: 'recordatorio_deuda',
      entidadId: fila.rows[0].id,
      despues: { instructor: d.nombre, destinatario: d.email, monto: d.monto, estado, modo_prueba: modoPrueba, motivo },
    });
    resultados.push({ instructor_id: d.instructor_id, nombre: d.nombre, estado, modo_prueba: modoPrueba, motivo });
  }
  return resultados;
}
