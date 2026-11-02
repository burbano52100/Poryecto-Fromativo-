import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useActualizarUsuarioSesion } from './useAuth';
import type { User } from '../schemas/auth.schema';

/** PATCH /api/perfil: nombre, correo institucional y ficha del usuario en sesión. */
export const useActualizarPerfil = () => {
  const actualizarSesion = useActualizarUsuarioSesion();
  return useMutation({
    mutationFn: async (datos: { name?: string; email?: string; ficha?: string }) =>
      (await apiClient.patch<{ message: string; user: User }>('/perfil', datos)).data,
    onSuccess: (data) => actualizarSesion(data.user),
  });
};
