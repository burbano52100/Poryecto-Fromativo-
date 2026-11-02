import { useState, useMemo } from 'react';
import {
  Users,
  Award,
  Search,
  UserCheck,
  UserX,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Sparkles,
  Info,
  IdCard,
  BookOpen,
} from 'lucide-react';
import {
  useEstudiantesQuery,
  useToggleBeneficiarioMutation,
  type EstudianteBeneficiario,
} from '../../hooks/useBeneficiarios';
import { Button } from '../atoms/Button';
import { ErrorAlert } from '../molecules/ErrorAlert';

export const BeneficiariosSection = () => {
  // Tab selector: 'todos' | 'actuales'
  const [activeTab, setActiveTab] = useState<'todos' | 'actuales'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [fichaFilter, setFichaFilter] = useState<string>('todas');

  // Modal para confirmar revocación / quitar beneficio
  const [studentToRevoke, setStudentToRevoke] = useState<EstudianteBeneficiario | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<unknown>(null);

  const { data: estudiantes = [], isLoading, isError, error, refetch } = useEstudiantesQuery();
  const toggleMutation = useToggleBeneficiarioMutation();

  // Fichas únicas para el select de filtro
  const fichasDisponibles = useMemo(() => {
    const fichasSet = new Set<string>();
    estudiantes.forEach((est) => {
      if (est.ficha) fichasSet.add(est.ficha);
    });
    return Array.from(fichasSet).sort();
  }, [estudiantes]);

  // Beneficiarios actuales
  const beneficiariosActuales = useMemo(() => {
    return estudiantes.filter((est) => est.es_beneficiario);
  }, [estudiantes]);

  // Filtrado de la lista según la pestaña activa, término de búsqueda y ficha
  const listadoFiltrado = useMemo(() => {
    const baseList = activeTab === 'todos' ? estudiantes : beneficiariosActuales;

    return baseList.filter((est) => {
      const matchSearch =
        est.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        est.document.includes(searchTerm) ||
        est.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        est.ficha.includes(searchTerm);

      const matchFicha = fichaFilter === 'todas' || est.ficha === fichaFilter;

      return matchSearch && matchFicha;
    });
  }, [activeTab, estudiantes, beneficiariosActuales, searchTerm, fichaFilter]);

  // Acción: Agregar como beneficiario
  const handleAddBeneficiario = (student: EstudianteBeneficiario) => {
    toggleMutation.mutate(
      { usuarioId: student.id, es_beneficiario: true },
      {
        onError: setMutationError,
        onSuccess: (res) => {
          setMutationError(null);
          setFeedbackMessage(res.message);
          setTimeout(() => setFeedbackMessage(null), 4000);
        },
      }
    );
  };

  // Acción: Confirmar y Quitar beneficiario
  const handleConfirmRevoke = () => {
    if (!studentToRevoke) return;

    toggleMutation.mutate(
      { usuarioId: studentToRevoke.id, es_beneficiario: false },
      {
        onError: (err) => {
          setMutationError(err);
          setStudentToRevoke(null);
        },
        onSuccess: (res) => {
          setMutationError(null);
          setFeedbackMessage(res.message);
          setStudentToRevoke(null);
          setTimeout(() => setFeedbackMessage(null), 4000);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Header con Acento Ámbar */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden border border-amber-400/30">
        <div className="absolute right-[-20px] top-[-20px] opacity-15 pointer-events-none">
          <Award className="w-56 h-56 text-white" />
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-amber-100 mb-3 border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Gestión del Programa de Almuerzos $0</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Módulo de Beneficiarios
          </h2>

          <p className="text-sm sm:text-base text-amber-100 mt-2 leading-relaxed">
            Administra los aprendices del SENA con subsidio del 100% en el almuerzo del comedor escolar ($0). Los beneficiarios reservan con un solo clic y no se les cobra saldo.
          </p>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className="bg-emerald-600 text-white rounded-2xl p-4 shadow-xl flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-200 shrink-0" />
            <p className="text-sm font-bold">{feedbackMessage}</p>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-white hover:text-emerald-200 text-xs underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {mutationError !== null && (
        <ErrorAlert
          error={mutationError}
          titulo="No se pudo actualizar el beneficio"
          onCerrar={() => setMutationError(null)}
        />
      )}

      {/* 2. Tarjetas Estadísticas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Beneficiarios Activos
            </p>
            <p className="text-2xl font-black text-amber-700">
              {beneficiariosActuales.length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Aprendices Registrados
            </p>
            <p className="text-2xl font-black text-gray-800">
              {estudiantes.length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Tarifa Subsidio
            </p>
            <p className="text-2xl font-black text-emerald-700">
              $0 <span className="text-xs font-normal text-gray-500">(100% Gratis)</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. Pestañas de Vista & Filtros */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          {/* Tabs principales */}
          <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('todos')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'todos'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Todos los estudiantes registrados</span>
              <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full ml-1 font-mono">
                {estudiantes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('actuales')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'actuales'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Beneficiarios actuales</span>
              <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full ml-1 font-mono">
                {beneficiariosActuales.length}
              </span>
            </button>
          </div>

          {/* Indicador de ayuda */}
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {activeTab === 'todos'
                ? 'Lista general de aprendices en el sistema para asignar subsidios'
                : 'Aprendices con almuerzo activo a $0 (puedes revocar el subsidio)'}
            </span>
          </div>
        </div>

        {/* Buscador y Filtro por Ficha */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, cédula o ficha..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-semibold"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={fichaFilter}
              onChange={(e) => setFichaFilter(e.target.value)}
              className="w-full sm:w-48 py-2.5 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium text-gray-700"
            >
              <option value="todas">Todas las fichas</option>
              {fichasDisponibles.map((f) => (
                <option key={f} value={f}>
                  Ficha: {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. Tabla / Listado de Estudiantes */}
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">
              Cargando estudiantes de GastroSENA...
            </p>
          </div>
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudo cargar la lista de aprendices" onReintentar={() => refetch()} />
        ) : listadoFiltrado.length === 0 ? (
          <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">No se encontraron aprendices</p>
            <p className="text-xs text-gray-500 mt-1">
              Prueba cambiando los términos de búsqueda o el filtro de ficha.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200/80">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/90 text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Aprendiz / Nombre
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Documento & Ficha
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Correo Misena
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Estado Beneficio
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {listadoFiltrado.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-amber-50/30 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border ${
                            student.es_beneficiario
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                          }`}
                        >
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 flex items-center gap-1.5">
                            {student.name}
                            {student.es_beneficiario && (
                              <Award className="w-3.5 h-3.5 text-amber-500" />
                            )}
                          </p>
                          <p className="text-xs text-gray-400">
                            ID: {student.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                          <IdCard className="w-3.5 h-3.5 text-gray-500" />
                          {student.document}
                        </span>
                        <div>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                            Ficha: {student.ficha || 'Sin ficha'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs font-medium text-gray-600">
                      {student.email}
                    </td>

                    <td className="px-5 py-4">
                      {student.es_beneficiario ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            <Award className="w-3.5 h-3.5 text-amber-600" />
                            Beneficiario ($0)
                          </span>
                          <p className="text-[11px] text-amber-700 font-medium">
                            Subsidio 100% activo
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                            Tarifa Regular ($5.000)
                          </span>
                          <p className="text-[11px] text-gray-400 font-medium">
                            Sin subsidio
                          </p>
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      {student.es_beneficiario ? (
                        <button
                          onClick={() => setStudentToRevoke(student)}
                          disabled={toggleMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition cursor-pointer active:scale-95 disabled:opacity-50"
                          title="Quitar subsidio y regresar a tarifa $5.000"
                        >
                          <UserX className="w-3.5 h-3.5 text-red-600" />
                          <span>Quitar</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddBeneficiario(student)}
                          disabled={toggleMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs hover:shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
                          title="Hacer beneficiario de almuerzo gratis"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Agregar como beneficiario</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Modal de Confirmación para Quitar Beneficiario */}
      {studentToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-gray-900 animate-scale-up">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-center text-gray-900">
              ¿Quitar como Beneficiario?
            </h3>

            <p className="text-sm text-gray-600 text-center mt-2 leading-relaxed">
              ¿Estás seguro de quitar a{' '}
              <strong className="text-gray-900">{studentToRevoke.name}</strong> del
              programa de subsidio?
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-4 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  <strong>Regla de cobro:</strong> El precio del almuerzo volverá a ser{' '}
                  <span className="font-bold text-amber-800">$5.000 COP</span> a partir
                  de su <strong>siguiente reserva</strong>.
                </p>
              </div>
              <p className="text-gray-500 text-[11px] pl-6">
                * Las reservas ya realizadas anteriormente con subsidio no cambiarán de precio.
              </p>
            </div>

            <div className="mt-4 bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
              <p>
                <span className="font-bold">Cédula:</span> {studentToRevoke.document}
              </p>
              <p>
                <span className="font-bold">Ficha:</span> {studentToRevoke.ficha}
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setStudentToRevoke(null)}
                disabled={toggleMutation.isPending}
              >
                Cancelar
              </Button>
              <button
                onClick={handleConfirmRevoke}
                disabled={toggleMutation.isPending}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30 transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {toggleMutation.isPending ? 'Procesando...' : 'Sí, quitar beneficio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
