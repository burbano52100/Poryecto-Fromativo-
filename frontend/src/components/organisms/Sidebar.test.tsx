import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta, usuarioDePrueba } from '../../test/utils';
import type { ResumenEncargado } from '../../types/api';

const RESUMEN: ResumenEncargado = {
  ventasHoy: 4,
  ingresosHoy: 20000,
  porCobrarHoy: 0,
  deudasPendientes: { monto: 25000, cantidad: 2 },
  sugerenciasPendientes: 5,
  beneficiariosActivos: 0,
};

const abrirSidebar = (role: 'encargado' | 'aprendiz') =>
  renderConProveedores(
    <Sidebar user={usuarioDePrueba({ role })} activeSection="inicio" onSelectSection={() => {}} onLogout={() => {}} />
  );

describe('Sidebar', () => {
  it('los contadores del Encargado salen de la API, no de valores fijos', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(RESUMEN));
    abrirSidebar('encargado');

    expect(await screen.findByRole('button', { name: /Cartera de Deudas\s*2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buzón de Sugerencias\s*5/ })).toBeInTheDocument();
  });

  it('sin pendientes no muestra contador', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue(respuesta({ ...RESUMEN, deudasPendientes: { monto: 0, cantidad: 0 }, sugerenciasPendientes: 0 }));
    abrirSidebar('encargado');

    await waitFor(() => expect(get).toHaveBeenCalledWith('/dashboard/encargado'));
    expect(screen.getByRole('button', { name: 'Cartera de Deudas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buzón de Sugerencias' })).toBeInTheDocument();
  });

  it('los demás roles no piden el resumen del Encargado', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta({ totalAlmuerzos: 3 }));
    abrirSidebar('aprendiz');

    await waitFor(() => expect(get).toHaveBeenCalledWith('/consumos/resumen'));
    expect(get).not.toHaveBeenCalledWith('/dashboard/encargado');
  });
});
