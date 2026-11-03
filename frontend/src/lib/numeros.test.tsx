import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { limpiarNumero, soloNumeros, type ModoNumero } from './numeros';

describe('limpiarNumero', () => {
  it.each([
    ['n', ''],
    ['12abc', '12'],
    ['1e5', '15'],
    ['-3', '3'],
    ['2.5', '2.5'],
    ['2,5', '2.5'],
    ['1.2.3', '1.23'],
    ['3.', '3.'],
    ['.5', '.5'],
  ])('decimal: "%s" → "%s"', (valor, esperado) => {
    expect(limpiarNumero(valor, 'decimal')).toBe(esperado);
  });

  it.each([
    ['5.000', '5000'],
    ['$8000', '8000'],
    ['10056-789', '10056789'],
    ['2,5', '25'],
  ])('entero: "%s" → "%s"', (valor, esperado) => {
    expect(limpiarNumero(valor, 'entero')).toBe(esperado);
  });
});

/** Formulario mínimo con React Hook Form, como los del panel. */
const Campo = ({ modo, onValor }: { modo: ModoNumero; onValor: (valor: string) => void }) => {
  const { register, handleSubmit } = useForm<{ cantidad: string }>({ defaultValues: { cantidad: '' } });
  return (
    <form onSubmit={handleSubmit((data) => onValor(data.cantidad))}>
      <label htmlFor="cantidad">Cantidad</label>
      <input id="cantidad" {...soloNumeros(register('cantidad'), modo)} />
      <button type="submit">Guardar</button>
    </form>
  );
};

describe('soloNumeros', () => {
  it('no deja escribir letras y el formulario recibe solo el número', async () => {
    let enviado = '';
    render(<Campo modo="decimal" onValor={(v) => (enviado = v)} />);
    const campo = screen.getByLabelText('Cantidad');

    await userEvent.type(campo, 'n1a2,5b');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(campo).toHaveValue('12.5');
    expect(enviado).toBe('12.5');
    expect(campo).toHaveAttribute('inputmode', 'decimal');
  });

  it('en modo entero también bloquea el separador decimal', async () => {
    render(<Campo modo="entero" onValor={() => {}} />);
    const campo = screen.getByLabelText('Cantidad');

    await userEvent.type(campo, '5.000 pesos');

    expect(campo).toHaveValue('5000');
    expect(campo).toHaveAttribute('inputmode', 'numeric');
  });

  it('al pegar texto con letras deja solo los números', async () => {
    render(<Campo modo="decimal" onValor={() => {}} />);
    const campo = screen.getByLabelText('Cantidad');

    campo.focus();
    await userEvent.paste('Cantidad: 3,75 L');

    expect(campo).toHaveValue('3.75');
  });
});
