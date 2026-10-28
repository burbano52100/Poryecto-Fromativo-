import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface EstudianteBeneficiario {
  id: string;
  name: string;
  document: string;
  email: string;
  es_beneficiario: boolean;
  ficha: string;
  activo: boolean;
  created_at: string;
}

const BENEFICIARIOS_STORAGE_KEY = 'gastrosena_estudiantes_data';

// Datos iniciales de demostración alineados con los estudiantes del SENA
const DEFAULT_ESTUDIANTES: EstudianteBeneficiario[] = [
  {
    id: 'usr_aprendiz_01',
    name: 'Carlos Ruiz',
    document: '1005678901',
    email: 'carlos.ruiz@misena.edu.co',
    es_beneficiario: true,
    ficha: '2847251',
    activo: true,
    created_at: '2026-02-10T08:00:00Z',
  },
  {
    id: 'usr_aprendiz_02',
    name: 'Ana María Torres',
    document: '1005678902',
    email: 'ana.torres@misena.edu.co',
    es_beneficiario: false,
    ficha: '2847251',
    activo: true,
    created_at: '2026-02-12T09:30:00Z',
  },
  {
    id: 'usr_aprendiz_03',
    name: 'Brayan Sneider Rojas',
    document: '1005678903',
    email: 'brayan.rojas@misena.edu.co',
    es_beneficiario: true,
    ficha: '2847252',
    activo: true,
    created_at: '2026-02-14T11:15:00Z',
  },
  {
    id: 'usr_aprendiz_04',
    name: 'Daniela Valentina Castro',
    document: '1005678904',
    email: 'daniela.castro@misena.edu.co',
    es_beneficiario: false,
    ficha: '2847252',
    activo: true,
    created_at: '2026-02-15T14:20:00Z',
  },
  {
    id: 'usr_aprendiz_05',
    name: 'Mateo Gómez Pineda',
    document: '1005678905',
    email: 'mateo.gomez@misena.edu.co',
    es_beneficiario: false,
    ficha: '2847253',
    activo: true,
    created_at: '2026-02-18T10:00:00Z',
  },
  {
    id: 'usr_aprendiz_06',
    name: 'Laura Sofía Méndez',
    document: '1005678906',
    email: 'laura.mendez@misena.edu.co',
    es_beneficiario: true,
    ficha: '2847253',
    activo: true,
    created_at: '2026-02-20T16:45:00Z',
  },
  {
    id: 'usr_aprendiz_07',
    name: 'Juan Esteban Narváez',
    document: '1005678907',
    email: 'juan.narvaez@misena.edu.co',
    es_beneficiario: false,
    ficha: '2847254',
    activo: true,
    created_at: '2026-02-22T08:10:00Z',
  },
  {
    id: 'usr_aprendiz_08',
    name: 'Yessica Paola Ordóñez',
    document: '1005678908',
    email: 'yessica.ordonez@misena.edu.co',
    es_beneficiario: false,
    ficha: '2847254',
    activo: true,
    created_at: '2026-02-25T13:00:00Z',
  },
];

function getStoredEstudiantes(): EstudianteBeneficiario[] {
  try {
    const raw = localStorage.getItem(BENEFICIARIOS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Error leyendo estudiantes desde localStorage', err);
  }
  localStorage.setItem(BENEFICIARIOS_STORAGE_KEY, JSON.stringify(DEFAULT_ESTUDIANTES));
  return DEFAULT_ESTUDIANTES;
}

function saveStoredEstudiantes(data: EstudianteBeneficiario[]) {
  try {
    localStorage.setItem(BENEFICIARIOS_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Error guardando estudiantes en localStorage', err);
  }
}

export const ESTUDIANTES_QUERY_KEY = ['beneficiarios', 'estudiantes'];
export const BENEFICIARIOS_QUERY_KEY = ['beneficiarios', 'activos'];

/**
 * Hook para obtener todos los estudiantes registrados (rol Aprendiz).
 * Conecta con GET /api/beneficiarios/estudiantes y tiene fallback robusto a localStorage.
 */
export const useEstudiantesQuery = () => {
  return useQuery<EstudianteBeneficiario[]>({
    queryKey: ESTUDIANTES_QUERY_KEY,
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<EstudianteBeneficiario[]>('/beneficiarios/estudiantes');
        if (Array.isArray(data) && data.length > 0) {
          saveStoredEstudiantes(data);
          return data;
        }
      } catch {
        // En caso de que el backend no esté encendido o no responda, usamos el almacenamiento local persistente
      }
      return getStoredEstudiantes();
    },
    staleTime: 1000 * 30,
  });
};

/**
 * Hook para obtener exclusivamente los beneficiarios activos.
 * Conecta con GET /api/beneficiarios y tiene fallback a los estudiantes con es_beneficiario = true.
 */
export const useBeneficiariosQuery = () => {
  return useQuery<EstudianteBeneficiario[]>({
    queryKey: BENEFICIARIOS_QUERY_KEY,
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<EstudianteBeneficiario[]>('/beneficiarios');
        if (Array.isArray(data)) {
          return data;
        }
      } catch {
        // Fallback
      }
      const all = getStoredEstudiantes();
      return all.filter((est) => est.es_beneficiario);
    },
    staleTime: 1000 * 30,
  });
};

/**
 * Hook Mutation para Asignar o Quitar el beneficio de almuerzo a $0.
 * Conecta con PATCH /api/beneficiarios/:usuarioId { es_beneficiario: boolean }.
 */
export const useToggleBeneficiarioMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      usuarioId,
      es_beneficiario,
    }: {
      usuarioId: string;
      es_beneficiario: boolean;
    }) => {
      try {
        const { data } = await apiClient.patch<{ message: string; aprendiz: { id: string; name: string; document: string; es_beneficiario: boolean } }>(
          `/beneficiarios/${usuarioId}`,
          { es_beneficiario }
        );
        return data;
      } catch {
        // Si el backend no está disponible, actualizamos el fallback local
        const current = getStoredEstudiantes();
        const updated = current.map((est) =>
          est.id === usuarioId || est.document === usuarioId
            ? { ...est, es_beneficiario }
            : est
        );
        saveStoredEstudiantes(updated);

        // Si el usuario actual en sesión es el mismo aprendiz, actualizar su sesión
        const storedUserRaw = localStorage.getItem('gastrosena_user');
        if (storedUserRaw) {
          try {
            const parsedUser = JSON.parse(storedUserRaw);
            if (parsedUser.id === usuarioId || parsedUser.document === usuarioId) {
              parsedUser.es_beneficiario = es_beneficiario;
              localStorage.setItem('gastrosena_user', JSON.stringify(parsedUser));
            }
          } catch {
            // ignore
          }
        }

        const target = current.find((e) => e.id === usuarioId || e.document === usuarioId);
        return {
          message: es_beneficiario
            ? `Se asignó el beneficio de almuerzo gratis ($0) a ${target?.name || 'Aprendiz'}.`
            : `Se revocó el beneficio de almuerzo a ${target?.name || 'Aprendiz'}.`,
          aprendiz: {
            id: usuarioId,
            name: target?.name || 'Aprendiz',
            document: target?.document || '',
            es_beneficiario,
          },
        };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ESTUDIANTES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: BENEFICIARIOS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
};
