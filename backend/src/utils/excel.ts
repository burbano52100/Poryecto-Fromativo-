import ExcelJS from 'exceljs';

/**
 * Inyección de fórmulas (CSV/Excel injection): una celda de texto que empieza con =, +, - o @
 * (o con tabulador / retorno de carro) puede ejecutarse como fórmula al abrir el archivo.
 */
export const empiezaComoFormula = (valor: string): boolean => /^[=+\-@\t\r]/.test(valor);

/** Neutraliza un texto peligroso anteponiendo un apóstrofo (OWASP). Los números no se tocan. */
export const neutralizarCelda = <T>(valor: T): T | string =>
  typeof valor === 'string' && empiezaComoFormula(valor) ? `'${valor}` : valor;

export interface ColumnaExcel {
  encabezado: string;
  clave: string;
  ancho?: number;
  /** Formato numérico de Excel, p. ej. '"$"#,##0' para pesos. */
  formato?: string;
}

const COLOR_ENCABEZADO = 'FF15803D';

/** Agrega una hoja con encabezado en negrilla, filtros y las filas ya neutralizadas. */
export function agregarHoja(
  libro: ExcelJS.Workbook,
  nombre: string,
  columnas: ColumnaExcel[],
  filas: Record<string, unknown>[],
  filasPrevias: string[] = []
): ExcelJS.Worksheet {
  const hoja = libro.addWorksheet(nombre.slice(0, 31));
  for (const texto of filasPrevias) {
    const fila = hoja.addRow([neutralizarCelda(texto)]);
    fila.font = { bold: filasPrevias.indexOf(texto) === 0, size: filasPrevias.indexOf(texto) === 0 ? 14 : 10 };
  }
  if (filasPrevias.length > 0) hoja.addRow([]);

  const encabezado = hoja.addRow(columnas.map((c) => c.encabezado));
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO } };
  });

  for (const fila of filas) {
    hoja.addRow(columnas.map((c) => neutralizarCelda(fila[c.clave] ?? '')));
  }

  columnas.forEach((c, i) => {
    const columna = hoja.getColumn(i + 1);
    columna.width = c.ancho ?? Math.max(12, c.encabezado.length + 4);
    if (c.formato) columna.numFmt = c.formato;
  });
  hoja.autoFilter = {
    from: { row: encabezado.number, column: 1 },
    to: { row: encabezado.number, column: columnas.length },
  };
  return hoja;
}

export const libroABuffer = async (libro: ExcelJS.Workbook): Promise<Buffer> =>
  Buffer.from(await libro.xlsx.writeBuffer());

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
