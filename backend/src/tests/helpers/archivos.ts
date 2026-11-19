import ExcelJS from 'exceljs';
import type { Response } from 'superagent';

/** Libro .xlsx en memoria con una sola hoja; las celdas que empiezan con "=" se escriben como fórmulas. */
export async function crearXlsx(filas: (string | number)[][]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Datos');
  for (const fila of filas) {
    const row = hoja.addRow([]);
    fila.forEach((valor, i) => {
      const celda = row.getCell(i + 1);
      celda.value = typeof valor === 'string' && valor.startsWith('=') ? { formula: valor.slice(1) } : valor;
    });
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** Filas de texto de la primera hoja de un .xlsx. */
export async function leerXlsx(buffer: Buffer): Promise<string[][]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as unknown as ArrayBuffer);
  const filas: string[][] = [];
  libro.worksheets[0].eachRow((row) => {
    const valores: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      valores[col - 1] = cell.text;
    });
    filas.push(valores);
  });
  return filas;
}

/** Parser de supertest para recibir el cuerpo binario (Excel o PDF) como Buffer. */
export const binario = (res: Response, callback: (err: Error | null, body: Buffer) => void) => {
  const partes: Buffer[] = [];
  res.on('data', (parte: Buffer) => partes.push(parte));
  res.on('end', () => callback(null, Buffer.concat(partes)));
};
