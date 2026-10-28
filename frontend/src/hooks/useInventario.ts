// src/hooks/useInventario.ts
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface StockItem {
  code: string;
  name: string;
  category: string;
  unit: string;
  expiry: string;
  stock: number;
}

/**
 * Fetch inventory stock items.
 * Stale time: 30 seconds as per requirements.
 */
export const useInventario = (): UseQueryResult<StockItem[], Error> => {
  return useQuery<StockItem[], Error>({
    queryKey: ['inventario', 'stock'],
    queryFn: async () => {
      const { data } = await apiClient.get<StockItem[]>('/inventario/stock');
      return data;
    },
    staleTime: 30_000,
    retry: false,
  });
};
