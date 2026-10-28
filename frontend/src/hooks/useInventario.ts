// src/hooks/useInventario.ts
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import api from '../lib/api';

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
  return useQuery<StockItem[], Error>(
    ['inventario', 'stock'],
    async () => {
      const { data } = await api.get<StockItem[]>('/inventario/stock');
      return data;
    },
    {
      staleTime: 30_000,
      retry: false,
    }
  );
};
