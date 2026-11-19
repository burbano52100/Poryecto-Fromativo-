import PDFDocument from 'pdfkit';

/**
 * Tablas en PDF con pdfkit para los reportes (ADR 025): encabezado con título, rango de fechas
 * y fecha de generación; filas con salto de página y el encabezado de la tabla repetido.
 */
export type TipoColumna = 'texto' | 'pesos' | 'numero';

export interface ColumnaPdf {
  encabezado: string;
  clave: string;
  /** Peso relativo del ancho de la columna. */
  ancho?: number;
  tipo?: TipoColumna;
}

export interface TablaPdf {
  titulo?: string;
  columnas: ColumnaPdf[];
  filas: Record<string, unknown>[];
  /** Líneas de resumen debajo de la tabla (p. ej. totales). */
  resumen?: string[];
}

export interface DocumentoPdf {
  titulo: string;
  subtitulos: string[];
  tablas: TablaPdf[];
  horizontal?: boolean;
}

const VERDE = '#15803d';
const GRIS = '#6b7280';

export const formatoPesos = (valor: unknown): string => {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '';
  const signo = n < 0 ? '-' : '';
  return `${signo}$${Math.round(Math.abs(n)).toLocaleString('es-CO')}`;
};

const celda = (valor: unknown, tipo: TipoColumna = 'texto'): string => {
  if (valor === null || valor === undefined || valor === '') return '';
  if (tipo === 'pesos') return formatoPesos(valor);
  if (tipo === 'numero') return Number(valor).toLocaleString('es-CO');
  return String(valor);
};

export function generarPdf(doc: DocumentoPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      layout: doc.horizontal ? 'landscape' : 'portrait',
      margin: 36,
      bufferPages: true,
      info: { Title: doc.titulo, Author: 'GastroSENA' },
    });
    const partes: Buffer[] = [];
    pdf.on('data', (p: Buffer) => partes.push(p));
    pdf.on('end', () => resolve(Buffer.concat(partes)));
    pdf.on('error', reject);

    const izquierda = pdf.page.margins.left;
    const anchoUtil = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
    const limiteInferior = () => pdf.page.height - pdf.page.margins.bottom - 20;

    // Encabezado del documento
    pdf.fillColor(VERDE).font('Helvetica-Bold').fontSize(16).text('GastroSENA', izquierda, pdf.y);
    pdf.fillColor('#111827').fontSize(14).text(doc.titulo);
    pdf.font('Helvetica').fontSize(9).fillColor(GRIS);
    for (const linea of doc.subtitulos) pdf.text(linea);
    pdf.moveDown(0.8);

    for (const tabla of doc.tablas) {
      if (tabla.titulo) {
        if (pdf.y > limiteInferior() - 60) pdf.addPage();
        pdf.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(tabla.titulo, izquierda, pdf.y);
        pdf.moveDown(0.3);
      }
      const pesoTotal = tabla.columnas.reduce((s, c) => s + (c.ancho ?? 1), 0);
      const anchos = tabla.columnas.map((c) => ((c.ancho ?? 1) / pesoTotal) * anchoUtil);
      const tamano = tabla.columnas.length > 8 ? 7 : 8;

      const dibujarFila = (valores: string[], negrilla: boolean, fondo?: string) => {
        pdf.font(negrilla ? 'Helvetica-Bold' : 'Helvetica').fontSize(tamano);
        const alto =
          Math.max(...valores.map((v, i) => pdf.heightOfString(v || ' ', { width: anchos[i] - 6 }))) + 6;
        if (pdf.y + alto > limiteInferior()) {
          pdf.addPage();
          if (!negrilla) dibujarEncabezado();
          pdf.font('Helvetica').fontSize(tamano);
        }
        const y = pdf.y;
        if (fondo) pdf.rect(izquierda, y, anchoUtil, alto).fill(fondo);
        let x = izquierda;
        valores.forEach((v, i) => {
          const tipo = tabla.columnas[i].tipo;
          pdf
            .fillColor(negrilla && fondo === VERDE ? '#ffffff' : '#111827')
            .text(v, x + 3, y + 3, { width: anchos[i] - 6, align: tipo === 'pesos' || tipo === 'numero' ? 'right' : 'left' });
          x += anchos[i];
        });
        pdf.moveTo(izquierda, y + alto).lineTo(izquierda + anchoUtil, y + alto).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        pdf.y = y + alto;
        pdf.x = izquierda;
      };
      const dibujarEncabezado = () => dibujarFila(tabla.columnas.map((c) => c.encabezado), true, VERDE);

      dibujarEncabezado();
      if (tabla.filas.length === 0) {
        pdf.font('Helvetica-Oblique').fontSize(9).fillColor(GRIS).text('Sin registros para los filtros elegidos.', izquierda + 3, pdf.y + 4);
        pdf.moveDown(0.5);
      }
      tabla.filas.forEach((fila, n) =>
        dibujarFila(
          tabla.columnas.map((c) => celda(fila[c.clave], c.tipo)),
          false,
          n % 2 === 1 ? '#f9fafb' : undefined
        )
      );
      if (tabla.resumen?.length) {
        pdf.moveDown(0.4);
        pdf.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
        for (const linea of tabla.resumen) pdf.text(linea, izquierda, pdf.y);
      }
      pdf.moveDown(1);
    }

    // Numeración de páginas
    const rango = pdf.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      pdf.switchToPage(i);
      // Sin margen inferior mientras se escribe el pie, para que pdfkit no agregue otra página
      const margenInferior = pdf.page.margins.bottom;
      pdf.page.margins.bottom = 0;
      pdf
        .font('Helvetica')
        .fontSize(8)
        .fillColor(GRIS)
        .text(`Página ${i + 1} de ${rango.count}`, izquierda, pdf.page.height - margenInferior + 10, {
          width: anchoUtil,
          align: 'right',
          lineBreak: false,
        });
    }
    pdf.end();
  });
}

export const TIPO_PDF = 'application/pdf';
