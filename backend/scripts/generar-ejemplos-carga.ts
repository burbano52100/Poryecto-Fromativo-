/**
 * Genera los archivos de ejemplo de la carga masiva del Coordinador en database/ejemplos/:
 * uno válido de aprendices, uno válido de instructores y uno de aprendices con errores
 * (vacíos, correo inválido, duplicados, cédula ya existente en la demo, ficha inválida y fórmulas).
 * Uso: npm run ejemplos:carga
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destino = path.resolve(__dirname, '../../database/ejemplos');
fs.mkdirSync(destino, { recursive: true });

const APRENDICES = ['Nombre completo', 'Cédula', 'Correo', 'Ficha', 'Programa (opcional)', 'Jornada (opcional)'];
const INSTRUCTORES = ['Nombre completo', 'Cédula', 'Correo', 'Teléfono (opcional)'];

async function guardar(nombre: string, filas: (string | { formula: string })[][]) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Datos');
  filas.forEach((fila, i) => {
    const row = hoja.addRow(fila.map((v) => (typeof v === 'string' ? v : { formula: v.formula })));
    if (i === 0) row.font = { bold: true };
  });
  hoja.columns.forEach((c) => (c.width = 28));
  // Las cédulas como texto, para que Excel no las convierta en número con notación científica
  hoja.getColumn(2).numFmt = '@';
  await libro.xlsx.writeFile(path.join(destino, nombre));
  console.log(`✓ ${path.join('database/ejemplos', nombre)}`);
}

await guardar('carga-aprendices-valido.xlsx', [
  APRENDICES,
  ['Laura Sofía Rojas', '1006000001', 'laura.rojas@soy.sena.edu.co', '2847251', 'Análisis y Desarrollo de Software', 'mañana'],
  ['Andrés Felipe Cruz', '1006000002', 'andres.cruz@soy.sena.edu.co', '2847251', '', ''],
  ['Juliana Ospina Rivera', '1006000003', 'juliana.ospina@soy.sena.edu.co', '2847253', '', 'tarde'],
  ['Mateo Hernández Polo', '1006000004', 'mateo.hernandez@soy.sena.edu.co', '3011223', 'Cocina', 'mañana'],
  ['Daniela Castro Suárez', '1006000005', 'daniela.castro@soy.sena.edu.co', '3011223', 'Cocina', 'mañana'],
]);

await guardar('carga-instructores-valido.xlsx', [
  INSTRUCTORES,
  ['Patricia Lozano Méndez', '1060000011', 'plozano@sena.edu.co', '3001234567'],
  ['Héctor Fabio Quintero', '1060000012', 'hquintero@sena.edu.co', ''],
  ['Mónica Liliana Charry', '1060000013', 'mcharry@sena.edu.co', '+57 310 555 1234'],
]);

await guardar('carga-aprendices-con-errores.xlsx', [
  APRENDICES,
  ['Sara Valentina López', '1006000101', 'sara.lopez@soy.sena.edu.co', '2847251', '', ''], // válida
  ['', '1006000102', 'sin.nombre@soy.sena.edu.co', '2847251', '', ''], // falta el nombre
  ['Tomás Ríos', '1006000103', 'correo-sin-arroba', '2847251', '', ''], // correo inválido
  ['Sara Copia', '1006000101', 'otra.sara@soy.sena.edu.co', '2847251', '', ''], // cédula repetida en el archivo
  ['Felipe Ramos', '1006000104', 'sara.lopez@soy.sena.edu.co', '2847251', '', ''], // correo repetido en el archivo
  ['Carlos Ruiz', '1005678901', 'carlos.nuevo@soy.sena.edu.co', '2847251', '', ''], // cédula ya existe (demo): se omite
  ['Natalia Gil', '1006000105', 'natalia.gil@soy.sena.edu.co', '28A7', '', ''], // ficha inválida
  [{ formula: 'HYPERLINK("http://ejemplo.com","clic")' }, '1006000106', 'formula@soy.sena.edu.co', '2847251', '', ''], // fórmula
  ['+cmd|calc', '1006000107', 'mas@soy.sena.edu.co', '2847251', '', ''], // empieza con +
  ['Paula Andrea Gómez', '12345', 'paula.gomez@soy.sena.edu.co', '2847251', '', ''], // cédula corta
  ['Ángela Beltrán', '1006000108', 'angela.beltran@soy.sena.edu.co', '2847251', '', 'madrugada'], // jornada inválida
]);
