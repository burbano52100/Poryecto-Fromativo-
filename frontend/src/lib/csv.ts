/** Descarga filas como CSV (separador ';' y BOM para que Excel en español lo abra bien). */
export const descargarCsv = (nombreArchivo: string, encabezados: string[], filas: (string | number)[][]): void => {
  const escapar = (valor: string | number) => {
    const texto = String(valor);
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const contenido = [encabezados, ...filas].map((fila) => fila.map(escapar).join(';')).join('\n');
  const blob = new Blob(['﻿', contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
};
