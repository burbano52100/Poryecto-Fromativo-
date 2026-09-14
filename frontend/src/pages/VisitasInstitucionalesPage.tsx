import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Users,
  DollarSign,
  CalendarClock,
  Plus,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { Button } from '../components/atoms/Button';
import { FormField } from '../components/molecules/FormField';
import { Label } from '../components/atoms/Label';

interface Institucion {
  id: string;
  nombre: string;
  tipo: string;
  ciudad: string;
  activo: boolean;
}

interface Instructor {
  id: string;
  document: string;
  name: string;
  email: string;
}

interface Visita {
  id: string;
  institucion_id: string;
  institucion_nombre: string;
  instructor_id?: string;
  nombre_instructor_ext?: string;
  cantidad_personas: number;
  fecha_visita: string;
  precio_unitario: number;
  total_a_cobrar: number;
  estado: string;
  metodo_pago: string;
  estado_pago: string;
  created_at: string;
}

interface VisitasKpi {
  totalVisitasMes: number;
  totalPersonasAtendidas: number;
  ingresosVisitas: number;
}

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const selectClassName =
  'w-full py-2.5 px-4 bg-gray-100/90 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white transition';

export default function VisitasInstitucionalesPage() {
  const queryClient = useQueryClient();

  const [institucionId, setInstitucionId] = useState('');
  const [instructorMode, setInstructorMode] = useState<'interno' | 'externo'>('interno');
  const [instructorId, setInstructorId] = useState('');
  const [nombreExterno, setNombreExterno] = useState('');
  const [cantidadPersonas, setCantidadPersonas] = useState('');
  const [fechaVisita, setFechaVisita] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const institucionesQuery = useQuery({
    queryKey: ['instituciones'],
    queryFn: async () => (await apiClient.get<Institucion[]>('/instituciones')).data,
  });

  const instructoresQuery = useQuery({
    queryKey: ['instructores'],
    queryFn: async () => (await apiClient.get<Instructor[]>('/instructores')).data,
  });

  const visitasQuery = useQuery({
    queryKey: ['visitas'],
    queryFn: async () => (await apiClient.get<Visita[]>('/visitas')).data,
  });

  const kpiQuery = useQuery({
    queryKey: ['visitas', 'kpi'],
    queryFn: async () => (await apiClient.get<VisitasKpi>('/visitas/kpi')).data,
  });

  const crearVisitaMutation = useMutation({
    mutationFn: async (payload: {
      institucion_id: string;
      instructor_id?: string;
      nombre_instructor_ext?: string;
      cantidad_personas: number;
      fecha_visita: string;
    }) => (await apiClient.post<Visita>('/visitas', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      queryClient.invalidateQueries({ queryKey: ['visitas', 'kpi'] });
      setFormSuccess('¡Visita registrada correctamente!');
      setInstitucionId('');
      setInstructorId('');
      setNombreExterno('');
      setCantidadPersonas('');
      setFechaVisita('');
      setTimeout(() => setFormSuccess(null), 3000);
    },
    onError: () => {
      setFormError('No fue posible registrar la visita. Intenta nuevamente.');
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!institucionId) {
      setFormError('Selecciona la institución que realiza la visita.');
      return;
    }

    if (instructorMode === 'interno' && !instructorId) {
      setFormError('Selecciona el instructor responsable de la visita.');
      return;
    }

    if (instructorMode === 'externo' && !nombreExterno.trim()) {
      setFormError('Ingresa el nombre del instructor externo.');
      return;
    }

    const cantidad = Number(cantidadPersonas);
    if (!cantidad || cantidad <= 0) {
      setFormError('La cantidad de personas debe ser un número mayor a cero.');
      return;
    }

    if (!fechaVisita) {
      setFormError('Selecciona la fecha de la visita.');
      return;
    }

    crearVisitaMutation.mutate({
      institucion_id: institucionId,
      instructor_id: instructorMode === 'interno' ? instructorId : undefined,
      nombre_instructor_ext: instructorMode === 'externo' ? nombreExterno.trim() : undefined,
      cantidad_personas: cantidad,
      fecha_visita: fechaVisita,
    });
  };

  const kpi = kpiQuery.data;
  const visitas = visitasQuery.data ?? [];
  const instituciones = institucionesQuery.data ?? [];
  const instructores = instructoresQuery.data ?? [];

  return (
    <main className="relative min-h-screen w-full p-4 sm:p-6 lg:p-8 font-sans bg-gradient-to-br from-gray-50 via-emerald-50 to-amber-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Encabezado */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-green-600 shadow-lg flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                Visitas Institucionales
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">
                Panel del Encargado &middot; Gestión de visitas al comedor SENA
              </p>
            </div>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-5 border border-white/40 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
              <CalendarClock className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Visitas del Mes</p>
              <p className="text-2xl font-extrabold text-gray-900">
                {kpiQuery.isLoading ? '—' : kpi?.totalVisitasMes ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-5 border border-white/40 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Personas Atendidas</p>
              <p className="text-2xl font-extrabold text-gray-900">
                {kpiQuery.isLoading ? '—' : kpi?.totalPersonasAtendidas ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-5 border border-white/40 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Ingresos por Visitas</p>
              <p className="text-2xl font-extrabold text-gray-900">
                {kpiQuery.isLoading ? '—' : currencyFormatter.format(kpi?.ingresosVisitas ?? 0)}
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Formulario de registro */}
          <section className="lg:col-span-2 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-6 border border-white/40 h-fit">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-green-600" />
              Registrar Nueva Visita
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs sm:text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label required>Institución</Label>
                <select
                  className={selectClassName}
                  value={institucionId}
                  onChange={(e) => setInstitucionId(e.target.value)}
                >
                  <option value="">Selecciona una institución</option>
                  {instituciones.map((institucion) => (
                    <option key={institucion.id} value={institucion.id}>
                      {institucion.nombre} ({institucion.ciudad})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label required>Instructor Responsable</Label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setInstructorMode('interno')}
                    className={`py-2 rounded-xl text-xs sm:text-sm font-semibold border transition cursor-pointer ${
                      instructorMode === 'interno'
                        ? 'bg-green-600 text-white border-green-600 shadow-md'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Instructor SENA
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstructorMode('externo')}
                    className={`py-2 rounded-xl text-xs sm:text-sm font-semibold border transition cursor-pointer ${
                      instructorMode === 'externo'
                        ? 'bg-green-600 text-white border-green-600 shadow-md'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Nombre Externo
                  </button>
                </div>

                {instructorMode === 'interno' ? (
                  <select
                    className={selectClassName}
                    value={instructorId}
                    onChange={(e) => setInstructorId(e.target.value)}
                  >
                    <option value="">Selecciona un instructor</option>
                    {instructores.map((instructor) => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <FormField
                    label=""
                    className="space-y-0"
                    placeholder="Nombre del instructor externo"
                    value={nombreExterno}
                    onChange={(e) => setNombreExterno(e.target.value)}
                  />
                )}
              </div>

              <FormField
                label="Cantidad de Personas"
                type="number"
                min={1}
                placeholder="Ej: 25"
                required
                value={cantidadPersonas}
                onChange={(e) => setCantidadPersonas(e.target.value)}
              />

              <FormField
                label="Fecha de la Visita"
                type="date"
                required
                value={fechaVisita}
                onChange={(e) => setFechaVisita(e.target.value)}
              />

              <Button type="submit" variant="primary" fullWidth isLoading={crearVisitaMutation.isPending}>
                Registrar Visita
              </Button>
            </form>
          </section>

          {/* Lista de visitas */}
          <section className="lg:col-span-3 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-6 border border-white/40">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-green-600" />
              Visitas Registradas
            </h2>

            {visitasQuery.isLoading ? (
              <p className="text-sm text-gray-500 text-center py-8">Cargando visitas...</p>
            ) : visitas.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Aún no hay visitas institucionales registradas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                      <th className="py-2 pr-3 font-semibold">Institución</th>
                      <th className="py-2 pr-3 font-semibold">Responsable</th>
                      <th className="py-2 pr-3 font-semibold">Personas</th>
                      <th className="py-2 pr-3 font-semibold">Fecha</th>
                      <th className="py-2 pr-3 font-semibold">Total</th>
                      <th className="py-2 pr-0 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitas.map((visita) => (
                      <tr key={visita.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-2.5 pr-3 font-semibold text-gray-800">{visita.institucion_nombre}</td>
                        <td className="py-2.5 pr-3 text-gray-600">
                          {visita.nombre_instructor_ext || visita.instructor_id || '—'}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-600">{visita.cantidad_personas}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{visita.fecha_visita}</td>
                        <td className="py-2.5 pr-3 text-gray-600">
                          {currencyFormatter.format(visita.total_a_cobrar)}
                        </td>
                        <td className="py-2.5 pr-0">
                          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-amber-100 text-amber-900 border-amber-300 capitalize">
                            {visita.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
