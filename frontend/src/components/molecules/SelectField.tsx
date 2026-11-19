import { ErrorMessage, Label, ListBox, Select } from '@heroui/react';

export interface OpcionSelect {
  id: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  opciones: readonly OpcionSelect[];
  /** Oculta la etiqueta visualmente (sigue disponible para lectores de pantalla). */
  ocultarLabel?: boolean;
  placeholder?: string;
  name?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  onBlur?: () => void;
  className?: string;
}

/** Select de HeroUI para listas cortas de opciones de texto. */
export const SelectField = ({
  label,
  value,
  onChange,
  opciones,
  ocultarLabel = false,
  placeholder = 'Selecciona una opción',
  name,
  error,
  required,
  disabled,
  onBlur,
  className = '',
}: SelectFieldProps) => (
  <Select
    className={`flex flex-col gap-1 ${className}`}
    placeholder={placeholder}
    name={name}
    value={value || null}
    onChange={(key) => onChange(key == null ? '' : String(key))}
    onBlur={onBlur}
    isInvalid={!!error}
    isRequired={required}
    isDisabled={disabled}
    fullWidth
  >
    <Label className={ocultarLabel ? 'sr-only' : undefined}>{label}</Label>
    <Select.Trigger>
      <Select.Value />
      <Select.Indicator />
    </Select.Trigger>
    {error && <ErrorMessage>{error}</ErrorMessage>}
    <Select.Popover>
      <ListBox>
        {opciones.map((o) => (
          <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
            {o.label}
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
      </ListBox>
    </Select.Popover>
  </Select>
);
