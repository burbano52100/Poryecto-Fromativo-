import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { queryKeys } from './queryKeys';
import type { Estudiante } from '../types/api';

/** Aprendiz registrado tal como lo muestra el módulo (correo vacío si no tiene). */
export interface EstudianteBeneficiario extends Omit<Estudiante, 'email'> {
  email: string;
}

/**
 * GET /api/beneficiarios/estudiantes (solo Encargado): todos los aprendices registrados
 * con su estado de beneficiario. Los beneficiarios actuales se filtran de esta misma lista.
 */
export const useEstudiantesQuery = () =>
  useQuery({
    queryKey: queryKeys.estudiantes,
    queryFn: async (): Promise<EstudianteBeneficiario[]> => {
      const { data } = await apiClient.get<Estudiante[]>('/beneficiarios/estudiantes');
      return data.map((estudiante) => ({ ...estudiante, email: estudiante.email ?? '' }));
    },
  });

/**
 * PATCH /api/beneficiarios/:usuarioId. El precio $0 lo aplica el backend desde la
 * siguiente reserva; las reservas anteriores conservan su precio.
 */
export const useToggleBeneficiarioMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ usuarioId, es_beneficiario }: { usuarioId: string; es_beneficiario: boolean }) =>
      (
        await apiClient.patch<{ message: string; aprendiz: { id: string; name: string } }>(
          `/beneficiarios/${usuarioId}`,
          { es_beneficiario }
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.estudiantes });
      queryClient.invalidateQueries({ queryKey: queryKeys.resumenEncargado });
    },
  });
};
