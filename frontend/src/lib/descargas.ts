import axios from 'axios';
import { apiClient } from './api';

/**
 * Descarga un archivo del backend (Excel o PDF) con la sesión actual y lo guarda con `nombre`.
 * Con responseType 'blob' el error del backend también llega como Blob: se lee para mostrar su mensaje.
 */
export async function descargarArchivo(url: string, nombre: string, params?: Record<string, string | undefined>) {
  try {
    const { data } = await apiClient.get<Blob>(url, { params, responseType: 'blob', timeout: 60_000 });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(data);
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(enlace.href);
  } catch (error) {
    const cuerpo = axios.isAxiosError(error) ? error.response?.data : undefined;
    if (cuerpo instanceof Blob) {
      const message = await cuerpo
        .text()
        .then((texto) => JSON.parse(texto).message)
        .catch(() => undefined);
      if (typeof message === 'string') throw new Error(message);
    }
    throw error;
  }
}
