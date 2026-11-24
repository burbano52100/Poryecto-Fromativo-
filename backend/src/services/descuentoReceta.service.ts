import type pg from 'pg';
import type { AuthenticatedUser } from '../middleware/auth.middleware.js';
import { fechaLegible } from '../utils/horario.js';
import { DECIMALES_STOCK, registrarMovimiento } from './inventario.service.js';
import { registrarAuditoria } from './auditoria.service.js';
import { crearAlerta } from './alertas.service.js';

/**
 * Descuento automático de inventario por receta (ADR 020).
 *
 * Cada almuerzo vendido (reserva de aprendiz o instructor, reserva de beneficiario o cada persona
 * de un registro de Almuerzos Invitados) descuenta los ingredientes de la receta del menú: las
 * cantidades de la receta son por porción (un plato). Cada ingrediente genera una "salida" en el
 * kardex que apunta a la venta o al registro (referencia_tipo / referencia_id).
 *
 * Si el stock no alcanza, la venta no se bloquea: se descuenta lo que haya (el saldo nunca queda
 * negativo), el material queda en Crítico y se alerta al encargado con el faltante.
 * Debe llamarse dentro de la transacción de la reserva o del registro.
 */
type Usuario = Pick<AuthenticatedUser, 'id' | 'name' | 'role'> | null | undefined;

/** A qué apunta la salida del kardex: una reserva, un registro de invitados o un almuerzo especial (ADR 024). */
export type ReferenciaInventario = 'venta' | 'almuerzo_invitado' | 'almuerzo_especial';

export interface Faltante {
  material: string;
  unidad: string;
  requerido: number;
  descontado: number;
  faltante: number;
}

export interface ResultadoDescuento {
  /** El menú no tiene receta (o no hay menú ese día): no se descontó nada. */
  sinReceta: boolean;
  receta: string | null;
  porciones: number;
  movimientos: { material: string; cantidad: number; saldo: number; unidad: string }[];
  faltantes: Faltante[];
}

/**
 * El stock tiene 2 decimales (NUMERIC(12,2)): lo descontado se redondea a 2 decimales para que la
 * salida del kardex sea exactamente lo que bajó el stock y la reversa lo devuelva sin diferencias.
 */
const redondearStock = (valor: number) => Math.round((valor + Number.EPSILON) * 10 ** DECIMALES_STOCK) / 10 ** DECIMALES_STOCK;

/** Menú del día de una fecha (el activo primero) con su receta. */
export async function menuDeFecha(client: pg.PoolClient, fecha: string) {
  const res = await client.query(
    `SELECT m.id, m.nombre, m.receta_id, TO_CHAR(m.fecha, 'YYYY-MM-DD') AS fecha
     FROM menus_dia m
     WHERE m.fecha = $1 AND m.estado IN ('activo', 'agotado', 'completado')
     ORDER BY (m.estado = 'activo') DESC, m.created_at DESC
     LIMIT 1;`,
    [fecha]
  );
  return (res.rows[0] ?? null) as { id: string; nombre: string; receta_id: string | null; fecha: string } | null;
}

/** Avisa una sola vez por menú (o por fecha sin menú) que no hay receta con que descontar. */
async function avisarSinReceta(
  client: pg.PoolClient,
  menu: { id: string; nombre: string; fecha: string } | null,
  fecha: string,
  usuario: Usuario
) {
  const clave = menu ? menu.id : `fecha:${fecha}`;
  const yaAvisado = await client.query("SELECT 1 FROM alertas WHERE tipo = 'menu_sin_receta' AND datos->>'clave' = $1 LIMIT 1;", [
    clave,
  ]);
  if (yaAvisado.rowCount) return;
  const mensaje = menu
    ? `El menú "${menu.nombre}" del ${fechaLegible(menu.fecha)} no tiene receta: los almuerzos vendidos no descuentan inventario. Asígnale una receta en Menú del Día.`
    : `No hay menú del día para el ${fechaLegible(fecha)}: los almuerzos invitados de ese día no descuentan inventario.`;
  await crearAlerta('menu_sin_receta', mensaje, { clave, menuId: menu?.id ?? null, fecha }, client);
  await registrarAuditoria(
    {
      usuario,
      accion: 'omitir',
      entidad: 'movimiento_inventario',
      entidadId: menu?.id ?? null,
      despues: { motivo: menu ? 'menu_sin_receta' : 'sin_menu', fecha },
    },
    client
  );
}

/**
 * Descuenta del stock los ingredientes de `porciones` platos de la receta del menú.
 * `menu` es el menú vendido (o null si ese día no hay menú).
 */
export async function descontarPorReceta(
  client: pg.PoolClient,
  opciones: {
    menu: { id: string; nombre: string; receta_id: string | null; fecha: string } | null;
    fecha: string;
    porciones: number;
    referenciaTipo: ReferenciaInventario;
    referenciaId: string;
    concepto: string;
    usuario: Usuario;
  }
): Promise<ResultadoDescuento> {
  const { menu, porciones, usuario } = opciones;
  const vacio: ResultadoDescuento = { sinReceta: true, receta: null, porciones, movimientos: [], faltantes: [] };

  const recetaRes = menu?.receta_id
    ? await client.query('SELECT id, nombre FROM recetas WHERE id = $1 AND activa = true;', [menu.receta_id])
    : null;
  const receta = recetaRes?.rows[0] as { id: string; nombre: string } | undefined;
  if (!receta) {
    await avisarSinReceta(client, menu, opciones.fecha, usuario);
    return vacio;
  }

  // Orden fijo por material para que dos ventas simultáneas bloqueen en el mismo orden
  const ingredientes = await client.query(
    `SELECT ri.material_id, ri.cantidad::float8 AS cantidad, m.nombre, m.unidad_medida AS unidad,
            m.stock_actual::float8 AS stock
     FROM receta_ingredientes ri
     JOIN materiales m ON m.id = ri.material_id AND m.activo = true
     WHERE ri.receta_id = $1
     ORDER BY ri.material_id
     FOR UPDATE OF m;`,
    [receta.id]
  );

  const resultado: ResultadoDescuento = { sinReceta: false, receta: receta.nombre, porciones, movimientos: [], faltantes: [] };
  for (const ing of ingredientes.rows) {
    const requerido = redondearStock(ing.cantidad * porciones);
    const descontado = redondearStock(Math.min(requerido, Math.max(ing.stock, 0)));
    if (descontado > 0) {
      const mov = await registrarMovimiento(client, {
        materialId: ing.material_id,
        tipo: 'salida',
        cantidad: descontado,
        concepto: opciones.concepto,
        usuarioId: usuario?.id ?? null,
        referenciaTipo: opciones.referenciaTipo,
        referenciaId: opciones.referenciaId,
      });
      resultado.movimientos.push({ material: ing.nombre, cantidad: descontado, saldo: mov.saldo, unidad: ing.unidad });
    }
    if (descontado < requerido) {
      resultado.faltantes.push({
        material: ing.nombre,
        unidad: ing.unidad,
        requerido,
        descontado,
        faltante: redondearStock(requerido - descontado),
      });
    }
  }

  if (resultado.faltantes.length > 0) {
    const detalle = resultado.faltantes.map((f) => `${f.material}: faltan ${f.faltante} ${f.unidad}`).join('; ');
    await crearAlerta(
      'stock_insuficiente',
      `Stock insuficiente para "${receta.nombre}" (${porciones} porción${porciones === 1 ? '' : 'es'}). ${detalle}. El material quedó en Crítico.`,
      { receta: receta.nombre, referenciaTipo: opciones.referenciaTipo, referenciaId: opciones.referenciaId, faltantes: resultado.faltantes },
      client
    );
  }

  await registrarAuditoria(
    {
      usuario,
      accion: 'descontar',
      entidad: 'movimiento_inventario',
      entidadId: opciones.referenciaId,
      despues: {
        referencia: opciones.referenciaTipo,
        receta: receta.nombre,
        porciones,
        movimientos: resultado.movimientos,
        faltantes: resultado.faltantes,
      },
    },
    client
  );
  return resultado;
}

/**
 * Devuelve al stock lo que se descontó por una venta o un registro de invitados (movimiento
 * inverso en el kardex). Solo devuelve lo que sigue descontado: se puede llamar varias veces.
 */
export async function revertirDescuento(
  client: pg.PoolClient,
  opciones: { referenciaTipo: ReferenciaInventario; referenciaId: string; concepto: string; usuario: Usuario }
): Promise<{ material: string; cantidad: number; saldo: number }[]> {
  const reversa = `${opciones.referenciaTipo}_reversa`;
  const netos = await client.query(
    `SELECT k.material_id,
            SUM(CASE WHEN k.referencia_tipo = $1 THEN COALESCE(k.cantidad_salida, 0) ELSE 0 END)
              - SUM(CASE WHEN k.referencia_tipo = $3 THEN COALESCE(k.cantidad_entrada, 0) ELSE 0 END) AS neto
     FROM movimientos_kardex k
     JOIN materiales m ON m.id = k.material_id AND m.activo = true
     WHERE k.referencia_id = $2 AND k.referencia_tipo IN ($1, $3)
     GROUP BY k.material_id
     HAVING SUM(CASE WHEN k.referencia_tipo = $1 THEN COALESCE(k.cantidad_salida, 0) ELSE 0 END)
              - SUM(CASE WHEN k.referencia_tipo = $3 THEN COALESCE(k.cantidad_entrada, 0) ELSE 0 END) > 0
     ORDER BY k.material_id;`,
    [opciones.referenciaTipo, opciones.referenciaId, reversa]
  );

  const devueltos: { material: string; cantidad: number; saldo: number }[] = [];
  for (const fila of netos.rows) {
    const cantidad = redondearStock(Number(fila.neto));
    const mov = await registrarMovimiento(client, {
      materialId: fila.material_id,
      tipo: 'entrada',
      cantidad,
      concepto: opciones.concepto,
      usuarioId: opciones.usuario?.id ?? null,
      referenciaTipo: reversa,
      referenciaId: opciones.referenciaId,
    });
    devueltos.push({ material: mov.nombre, cantidad, saldo: mov.saldo });
  }

  if (devueltos.length > 0) {
    await registrarAuditoria(
      {
        usuario: opciones.usuario,
        accion: 'revertir',
        entidad: 'movimiento_inventario',
        entidadId: opciones.referenciaId,
        despues: { referencia: opciones.referenciaTipo, concepto: opciones.concepto, movimientos: devueltos },
      },
      client
    );
  }
  return devueltos;
}

/** Texto corto para avisar al encargado en la respuesta de la API. */
export const avisosInventario = (resultado: ResultadoDescuento): string[] => {
  if (resultado.sinReceta) return ['El menú de ese día no tiene receta: no se descontó inventario.'];
  return resultado.faltantes.map(
    (f) => `Stock insuficiente de ${f.material}: faltaron ${f.faltante} ${f.unidad} (quedó en Crítico).`
  );
};
