import type { ReactNode } from 'react';

export type AccountType = 'aprendiz' | 'instructor' | 'encargado';

export interface AccountTypeOption {
  id: AccountType;
  label: string;
  icon: ReactNode;
}

export interface LoginFormState {
  ficha: string;
  document: string;
  password: string;
}
