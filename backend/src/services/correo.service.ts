import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Envío de correos con Nodemailer (ADR 023). La configuración SMTP sale solo de variables de
 * entorno (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM). Sin SMTP_HOST el correo se
 * imprime en la consola y se marca como "modo prueba".
 */
export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

export interface ResultadoCorreo {
  modoPrueba: boolean;
}

let transporte: Transporter | null = null;
let configuracionUsada = '';

export const smtpConfigurado = (): boolean => Boolean(process.env.SMTP_HOST?.trim());

const obtenerTransporte = (): Transporter => {
  const port = Number(process.env.SMTP_PORT || 587);
  const clave = `${process.env.SMTP_HOST}|${port}|${process.env.SMTP_USER}`;
  if (!transporte || clave !== configuracionUsada) {
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    configuracionUsada = clave;
  }
  return transporte;
};

export async function enviarCorreo(correo: Correo): Promise<ResultadoCorreo> {
  if (!smtpConfigurado()) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(
        `[Correo · modo prueba] Para: ${correo.para}\nAsunto: ${correo.asunto}\n${correo.texto}\n${'-'.repeat(60)}`
      );
    }
    return { modoPrueba: true };
  }
  await obtenerTransporte().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: correo.para,
    subject: correo.asunto,
    text: correo.texto,
    html: correo.html,
  });
  return { modoPrueba: false };
}

/** Escapa texto para meterlo en el HTML del correo. */
export const escaparHtml = (texto: string): string =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
