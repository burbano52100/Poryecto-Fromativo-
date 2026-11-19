import { SearchField } from '@heroui/react';

interface SearchInputProps {
  /** Nombre accesible del buscador (no se muestra). */
  label: string;
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  className?: string;
}

/** Buscador de HeroUI (SearchField) con icono y botón para limpiar. */
export const SearchInput = ({ label, value, onChange, placeholder, className = 'w-full sm:w-64' }: SearchInputProps) => (
  <SearchField aria-label={label} value={value} onChange={onChange} className={className}>
    <SearchField.Group>
      <SearchField.SearchIcon />
      <SearchField.Input placeholder={placeholder} />
      <SearchField.ClearButton />
    </SearchField.Group>
  </SearchField>
);
