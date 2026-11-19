import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitasInstitucionalesSection } from './VisitasInstitucionalesSection';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta } from '../../test/utils';
import { nombresVisitaSchema } from '../../schemas/visitas.schema';

const DATOS: Record<string, unknown> = {
  '/visitas': [
    {
      id: 'vis-1',
      institucion_nombre: 'Colegio San José',
      responsable_nombre: 'María Gómez',
      cantidad_personas: 25,
      fecha_visita: '2026-11-20',
      precio_unitario: 11000,
      total_a_cobrar: 275000,
      estado: 'programada',
      metodo_pago: 'efectivo',
      estado_pago: 'pendiente',
      created_at: '2026-11-04T15:00:00.000Z',
    },
  ],
  '/visitas/kpi': { totalVisitasMes: 1, totalPersonasAtendidas: 25, ingresosVisitas: 275000 },
};

const simularApi = () => vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => respuesta(DATOS[url]));

describe('Visitas institucionales (Encargado)', () => {
  it('la tabla muestra la institución y el responsable tal como se escribieron, y la fecha legible', async () => {
    simularApi();
    renderConProveedores(<VisitasInstitucionalesSection />);

    const fila = (await screen.findByText('Colegio San José', { selector: 'td' })).closest('tr');
    expect(fila).toHaveTextContent('María Gómez');
    expect(fila).toHaveTextContent('20/11/2026');
    expect(fila).not.toHaveTextContent('Instructor SENA');
  });

  it('la institución y el responsable se escriben a mano: no hay listas ni botones para elegir', async () => {
    const get = simularApi();
    renderConProveedores(<VisitasInstitucionalesSection />);

    expect(await screen.findByLabelText(/Nombre de la Institución/)).toHaveAttribute('placeholder', 'Ej: Colegio San José');
    expect(screen.getByLabelText(/Nombre del Responsable/)).toHaveAttribute('placeholder', 'Ej: María Fernanda Gómez');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Instructor SENA' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nombre Externo' })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith('/instituciones');
    expect(get).not.toHaveBeenCalledWith('/instructores');
  });

  it('registra la visita con los nombres sin espacios sobrantes; la cantidad solo acepta números', async () => {
    simularApi();
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta({ id: 'vis-2' }));
    renderConProveedores(<VisitasInstitucionalesSection />);

    await userEvent.type(await screen.findByLabelText(/Nombre de la Institución/), '  Universidad Surcolombiana ');
    await userEvent.type(screen.getByLabelText(/Nombre del Responsable/), ' Pedro Pérez  ');
    const cantidad = screen.getByLabelText(/Cantidad de Personas/);
    await userEvent.type(cantidad, '3a0');
    expect(cantidad).toHaveValue('30');
    await userEvent.type(screen.getByLabelText(/Fecha de la Visita/), '2026-11-25');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar Visita' }));

    expect(post).toHaveBeenCalledWith('/visitas', {
      institucionNombre: 'Universidad Surcolombiana',
      responsableNombre: 'Pedro Pérez',
      cantidad_personas: 30,
      fecha_visita: '2026-11-25',
    });
    expect(await screen.findByText('¡Visita registrada correctamente!')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre de la Institución/)).toHaveValue('');
  });

  it('si faltan la institución o el responsable muestra el error debajo de cada campo y no envía', async () => {
    simularApi();
    const post = vi.spyOn(apiClient, 'post');
    renderConProveedores(<VisitasInstitucionalesSection />);

    await userEvent.type(await screen.findByLabelText(/Nombre del Responsable/), '    ');
    await userEvent.type(screen.getByLabelText(/Cantidad de Personas/), '10');
    await userEvent.type(screen.getByLabelText(/Fecha de la Visita/), '2026-11-25');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar Visita' }));

    const institucion = screen.getByLabelText(/Nombre de la Institución/);
    const responsable = screen.getByLabelText(/Nombre del Responsable/);
    expect(institucion).toHaveAccessibleDescription('El nombre de la institución es obligatorio.');
    expect(responsable).toHaveAccessibleDescription('El nombre del responsable es obligatorio.');
    expect(institucion).toHaveAttribute('aria-invalid', 'true');
    expect(post).not.toHaveBeenCalled();

    // Al escribir, el error de ese campo desaparece
    await userEvent.type(institucion, 'Colegio');
    expect(screen.queryByText('El nombre de la institución es obligatorio.')).not.toBeInTheDocument();
    expect(screen.getByText('El nombre del responsable es obligatorio.')).toBeInTheDocument();
  });

  it('los nombres admiten como máximo 150 caracteres', async () => {
    simularApi();
    renderConProveedores(<VisitasInstitucionalesSection />);

    expect(await screen.findByLabelText(/Nombre de la Institución/)).toHaveAttribute('maxLength', '150');
    expect(screen.getByLabelText(/Nombre del Responsable/)).toHaveAttribute('maxLength', '150');

    const largo = nombresVisitaSchema.safeParse({ institucionNombre: 'a'.repeat(151), responsableNombre: 'b'.repeat(150) });
    expect(largo.success).toBe(false);
    expect(largo.error?.issues.map((i) => i.message)).toEqual(['El nombre de la institución no puede superar 150 caracteres.']);
  });
});
