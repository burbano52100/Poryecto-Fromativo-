import { useState } from 'react';
import { CreditCard, Search, Download, AlertTriangle, CheckCircle2, Wallet } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { LoadingSpinner } from '../atoms/LoadingSpinner';
import { ConfirmDialog } from '../molecules/ConfirmDialog';
import { ErrorAlert } from '../molecules/ErrorAlert';
import { useCartera, usePagarDeuda } from '../../hooks/useCartera';
import { pesos } from '../../lib/formato';
import { filtrarNumero } from '../../lib/numeros';
import { descargarCsv } from '../../lib/csv';
import type { Deuda } from '../../types/api';

/**
 * Cartera de deudas de instructores. Un pago (total o abono) marca como pagados sus
 * almuerzos más antiguos; los aprendices se cobran en Grupos.
 */
export const CarteraDeudasSection = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deudaAPagar, setDeudaAPagar] = useState<Deuda | null>(null);
  const [montoTexto, setMontoTexto] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const { data: deudores = [], isPending, isError, error, refetch } = useCartera();
  const pagarDeuda = usePagarDeuda();

  const monto = montoTexto.trim() === '' ? undefined : Number(montoTexto);
  const montoInvalido = monto !== undefined && (!Number.isFinite(monto) || monto <= 0);

  const abrirPago = (deuda: Deuda) => {
    pagarDeuda.reset();
    setMontoTexto('');
    setDeudaAPagar(deuda);
  };

  const confirmarPago = () => {
    if (!deudaAPagar || montoInvalido) return;
    const deuda = deudaAPagar;
    pagarDeuda.mutate(
      { id: deuda.id, monto },
      {
        onSuccess: (res) => {
          setDeudaAPagar(null);
          setPaymentSuccess(
            res.saldoRestante > 0
              ? `${res.message} ${deuda.name} queda debiendo ${pesos(res.saldoRestante)}.`
              : `${res.message} La deuda de ${deuda.name} quedó saldada.`
          );
          setTimeout(() => setPaymentSuccess(null), 5000);
        },
      }
    );
  };

  const exportar = () =>
    descargarCsv(
      'cartera-deudas.csv',
      ['Deudor', 'Tipo', 'Cédula', 'Almuerzos', 'Deuda', 'Días', 'Estado'],
      deudores.map((d) => [d.name, d.type, d.document, d.lunchesCount, d.debt, d.daysOverdue, d.status])
    );

  const filteredDeudores = deudores.filter(
    (d) => d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.document.includes(searchTerm)
  );

  const totalDeudoresCount = deudores.length;
  const totalDebtSum = deudores.reduce((acc, d) => acc + d.debt, 0);
  const avgDebt = totalDeudoresCount > 0 ? totalDebtSum / totalDeudoresCount : 0;
  const maxDebt = deudores.reduce((max, d) => (d.debt > max ? d.debt : max), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-green-600" />
              Cartera de Deudas de Instructores
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Gestión de saldos pendientes y cobranza del comedor escolar
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            <input
              type="search"
              aria-label="Buscar deudor"
              placeholder="Buscar por nombre o C.C..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
          </div>
        </div>

        {paymentSuccess && (
          <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{paymentSuccess}</span>
          </div>
        )}

        {isPending ? (
          <LoadingSpinner label="Cargando cartera..." />
        ) : isError ? (
          <ErrorAlert error={error} titulo="No se pudo cargar la cartera" onReintentar={() => refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Instructor / Deudor</th>
                  <th className="py-3 px-4">Cédula</th>
                  <th className="py-3 px-4">Almuerzos</th>
                  <th className="py-3 px-4">Deuda Total</th>
                  <th className="py-3 px-4">Días</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredDeudores.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500 font-medium">
                      No hay deudas pendientes en este momento.
                    </td>
                  </tr>
                ) : (
                  filteredDeudores.map((deudor) => (
                    <tr key={deudor.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-4 px-4 font-bold text-gray-900">
                        {deudor.name}
                        <span className="block text-xs text-gray-400 font-normal">{deudor.type}</span>
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-700">{deudor.document}</td>
                      <td className="py-4 px-4 font-bold text-gray-800">{deudor.lunchesCount}</td>
                      <td className="py-4 px-4 font-extrabold text-amber-600">{pesos(deudor.debt)}</td>
                      <td className="py-4 px-4 font-medium text-gray-600">{deudor.daysOverdue} días</td>
                      <td className="py-4 px-4">
                        {deudor.status === 'VENCIDA' ? (
                          <Badge variant="red">Vencida</Badge>
                        ) : (
                          <Badge variant="green">Activa</Badge>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button
                          variant="primary"
                          onClick={() => abrirPago(deudor)}
                          className="bg-green-600 hover:bg-green-700 text-xs py-1.5 px-3 font-bold"
                        >
                          Registrar pago
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-4">
          <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-600" />
            Reporte
          </h3>
          <p className="text-sm text-gray-500">Descarga la cartera actual en un archivo CSV que abre en Excel.</p>
          <button
            onClick={exportar}
            disabled={deudores.length === 0}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-blue-800 font-bold text-sm hover:bg-blue-100 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Exportar Reporte de Deudas (CSV)</span>
            <Download className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 space-y-4">
          <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Resumen de Cartera
          </h3>

          <div className="grid grid-cols-3 gap-3 text-center pt-2">
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/70">
              <p className="text-xs text-gray-400 font-bold uppercase">Deudores</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{totalDeudoresCount}</p>
            </div>
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/70">
              <p className="text-xs text-gray-400 font-bold uppercase">Promedio</p>
              <p className="text-lg font-extrabold text-amber-600 mt-1.5">{pesos(avgDebt)}</p>
            </div>
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200/70">
              <p className="text-xs text-gray-400 font-bold uppercase">Mayor Deuda</p>
              <p className="text-lg font-extrabold text-red-600 mt-1.5">{pesos(maxDebt)}</p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        abierto={deudaAPagar !== null}
        titulo="Registrar pago de deuda"
        icono={<Wallet className="w-8 h-8" />}
        textoConfirmar={monto === undefined ? 'Pagar total' : `Abonar ${montoInvalido ? '' : pesos(monto)}`}
        onConfirmar={confirmarPago}
        onCancelar={() => setDeudaAPagar(null)}
        cargando={pagarDeuda.isPending}
      >
        {deudaAPagar && (
          <div className="space-y-3">
            <p className="text-center">
              <span className="font-bold text-gray-900">{deudaAPagar.name}</span> debe{' '}
              <span className="font-bold text-amber-600">{pesos(deudaAPagar.debt)}</span> ({deudaAPagar.lunchesCount}{' '}
              almuerzos).
            </p>
            <label htmlFor="monto-abono" className="block text-xs font-semibold text-gray-700">
              Monto a abonar (déjalo vacío para pagar el total)
            </label>
            <input
              id="monto-abono"
              inputMode="numeric"
              placeholder={String(deudaAPagar.debt)}
              value={montoTexto}
              onChange={(e) => {
                filtrarNumero(e, 'entero');
                setMontoTexto(e.target.value);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
            />
            {montoInvalido && <p className="text-xs font-semibold text-red-600">El monto debe ser mayor a 0.</p>}
            <p className="text-xs text-gray-500">
              El pago marca como pagados los almuerzos más antiguos que alcance a cubrir.
            </p>
            {pagarDeuda.isError && <ErrorAlert error={pagarDeuda.error} titulo="No se pudo registrar el pago" />}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};
