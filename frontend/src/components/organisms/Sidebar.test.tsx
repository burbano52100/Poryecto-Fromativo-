import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta, usuarioDePrueba } from '../../test/utils';
import type { ResumenEncargado } from '../../types/api';

const RESUMEN: ResumenEncargado = {
  ventasHoy: 4,
  ingresosHoy: 20000,
  invitadosHoy: 0,
  ingresosInvitadosHoy: 0,
  porCobrarHoy: 0,
  deudasPendientes: { monto: 25000, cantidad: 2 },
  sugerenciasPendientes: 5,
  beneficiariosActivos: 0,
};

const abrirSidebar = (role: 'encargado' | 'aprendiz' | 'coordinador' | 'instructor') =>
  renderConProveedores(
    <Sidebar user={usuarioDePrueba({ role })} activeSection="inicio" onSelectSection={() => {}} onLogout={() => {}} />
  );

describe('Sidebar', () => {
  it('los contadores del Encargado salen de la API, no de valores fijos', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(RESUMEN));
    abrirSidebar('encargado');

    // Margen amplio: con toda la suite en paralelo, la primera consulta por rol del Sidebar pasa de 1 s
    expect(await screen.findByRole('button', { name: /Cartera de deudas\s*2/ }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buzón de sugerencias\s*5/ })).toBeInTheDocument();
    // Las solicitudes de cuenta ahora las revisa el Coordinador (ADR 018)
    expect(screen.queryByRole('button', { name: /Solicitudes de cuenta/ })).not.toBeInTheDocument();
  });

  it('el Encargado tiene la sección Almuerzos invitados junto a Ventas y Menú del día', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta(RESUMEN));
    abrirSidebar('encargado');

    const nombres = (await screen.findAllByRole('button')).map((b) => b.textContent?.trim());
    const ventas = nombres.indexOf('Ventas');
    expect(nombres.slice(ventas, ventas + 3)).toEqual(['Ventas', 'Menú del día', 'Almuerzos invitados']);
  });

  it('el aprendiz no ve Almuerzos invitados', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta({ totalAlmuerzos: 3 }));
    abrirSidebar('aprendiz');
    expect(screen.queryByRole('button', { name: 'Almuerzos invitados' })).not.toBeInTheDocument();
  });

  it('sin pendientes no muestra contador', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue(
        respuesta({ ...RESUMEN, deudasPendientes: { monto: 0, cantidad: 0 }, sugerenciasPendientes: 0 })
      );
    abrirSidebar('encargado');

    await waitFor(() => expect(get).toHaveBeenCalledWith('/dashboard/encargado'));
    expect(screen.getByRole('button', { name: 'Cartera de deudas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buzón de sugerencias' })).toBeInTheDocument();
  });

  it('los demás roles no piden el resumen del Encargado', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta({ totalAlmuerzos: 3 }));
    abrirSidebar('aprendiz');

    await waitFor(() => expect(get).toHaveBeenCalledWith('/consumos'));
    expect(get).not.toHaveBeenCalledWith('/dashboard/encargado');
  });

  it('Mis fichas cuenta solo los almuerzos por pagar, no el total', async () => {
    const consumo = (id: string, estado_pago: string) => ({ id, estado_pago });
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      respuesta([consumo('1', 'pendiente'), consumo('2', 'pagado'), consumo('3', 'pendiente'), consumo('4', 'gratis')])
    );
    abrirSidebar('aprendiz');

    expect(await screen.findByRole('button', { name: /Mis fichas\s*2/ }, { timeout: 5000 })).toBeInTheDocument();
  });

  it('el instructor no lleva contador en Consumos', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(respuesta({ totalAlmuerzos: 9 }));
    abrirSidebar('instructor');

    expect(await screen.findByRole('button', { name: 'Consumos' })).toBeInTheDocument();
  });

  it('el Coordinador ve su menú y el contador de solicitudes pendientes', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValue(respuesta({ activos: 20, pendientes: 3, instructores: 4, aprendices: 16 }));
    abrirSidebar('coordinador');

    expect(await screen.findByRole('button', { name: /Solicitudes de cuenta\s*3/ }, { timeout: 5000 })).toBeInTheDocument();
    for (const item of ['Usuarios', 'Fichas', 'Carga masiva', 'Perfil']) {
      expect(screen.getByRole('button', { name: item })).toBeInTheDocument();
    }
    expect(screen.getByText('Coordinación Académica')).toBeInTheDocument();
    // No ve módulos del comedor ni pide sus datos
    expect(screen.queryByRole('button', { name: 'Ventas' })).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/coordinador/resumen');
    expect(get).not.toHaveBeenCalledWith('/dashboard/encargado');
    expect(get).not.toHaveBeenCalledWith('/consumos/resumen');
  });
});
