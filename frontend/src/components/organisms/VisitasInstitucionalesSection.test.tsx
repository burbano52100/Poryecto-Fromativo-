import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitasInstitucionalesSection } from './VisitasInstitucionalesSection';
import { apiClient } from '../../lib/api';
import { renderConProveedores, respuesta } from '../../test/utils';

const DATOS: Record<string, unknown> = {
  '/instituciones': [{ id: 'inst-1', nombre: 'Colegio San José', tipo: 'colegio', ciudad: 'Pitalito', activo: true }],
  '/instructores': [{ id: 'ins-1', document: '1098765432', name: 'María Gómez', email: 'mgomez@sena.edu.co' }],
  '/visitas': [
    {
      id: 'vis-1',
      institucion_id: 'inst-1',
      institucion_nombre: 'Colegio San José',
      instructor_id: 'ins-1',
      instructor_nombre: 'María Gómez',
      nombre_instructor_ext: null,
      cantidad_personas: 25,
      fecha_visita: '2026-11-20',
      precio_unitario: 8000,
      total_a_cobrar: 200000,
      estado: 'programada',
      metodo_pago: 'efectivo',
      estado_pago: 'pendiente',
      created_at: '2026-11-04T15:00:00.000Z',
    },
  ],
  '/visitas/kpi': { totalVisitasMes: 1, totalPersonasAtendidas: 25, ingresosVisitas: 200000 },
};

describe('Visitas institucionales (Encargado)', () => {
  it('muestra el nombre del instructor y la fecha legible, no el id', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => respuesta(DATOS[url]));
    renderConProveedores(<VisitasInstitucionalesSection />);

    const fila = (await screen.findByText('Colegio San José', { selector: 'td' })).closest('tr');
    expect(fila).toHaveTextContent('María Gómez');
    expect(fila).toHaveTextContent('20/11/2026');
    expect(fila).not.toHaveTextContent('ins-1');
  });

  it('registra una visita y la cantidad de personas solo acepta números', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => respuesta(DATOS[url]));
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(respuesta({ id: 'vis-2' }));
    renderConProveedores(<VisitasInstitucionalesSection />);

    await screen.findByRole('option', { name: 'María Gómez' });
    await userEvent.selectOptions(screen.getByLabelText(/Institución/), 'inst-1');
    await userEvent.selectOptions(screen.getByLabelText(/Instructor Responsable/), 'ins-1');
    const cantidad = screen.getByLabelText(/Cantidad de Personas/);
    await userEvent.type(cantidad, '3a0');
    expect(cantidad).toHaveValue('30');
    await userEvent.type(screen.getByLabelText(/Fecha de la Visita/), '2026-11-25');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar Visita' }));

    expect(post).toHaveBeenCalledWith('/visitas', {
      institucion_id: 'inst-1',
      instructor_id: 'ins-1',
      nombre_instructor_ext: undefined,
      cantidad_personas: 30,
      fecha_visita: '2026-11-25',
    });
    expect(await screen.findByText('¡Visita registrada correctamente!')).toBeInTheDocument();
  });
});
