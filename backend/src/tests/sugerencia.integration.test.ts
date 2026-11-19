import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/index.js';
import { cleanDatabase } from './helpers/db.js';
import { crearUsuario, type UsuarioTest } from './helpers/auth.js';
import { calcularSugerencia } from '../services/sugerencia.service.js';
import { restarDias } from '../utils/rango.js';

describe('calcularSugerencia (sin IA)', () => {
  const LUNES = '2026-11-16';
  const ventas = (valores: number[]) => new Map(valores.map((n, i) => [restarDias(LUNES, 7 * (i + 1)), n]));

  it('promedia los últimos 4 mismos días, suma el margen y redondea hacia arriba', () => {
    const s = calcularSugerencia(LUNES, ventas([40, 50, 45, 45]), { semanas: 4, margenPct: 10 });
    assert.strictEqual(s.dia_semana, 'lunes');
    assert.strictEqual(s.promedio, 45);
    assert.strictEqual(s.sugerencia, 50); // 45 × 1.10 = 49.5 → 50
    assert.strictEqual(s.mensaje, 'Sugerencia: preparar 50 almuerzos (promedio de los últimos 4 lunes: 45)');
    assert.deepStrictEqual(
      s.dias.map((d) => d.fecha),
      ['2026-11-09', '2026-11-02', '2026-10-26', '2026-10-19']
    );
  });

  it('no infla el resultado por errores de punto flotante (22 × 1,1 = 24,2 → 25; 20 × 1,1 = 22)', () => {
    assert.strictEqual(calcularSugerencia(LUNES, ventas([20, 20]), { semanas: 4, margenPct: 10 }).sugerencia, 22);
    assert.strictEqual(calcularSugerencia(LUNES, ventas([22, 22]), { semanas: 4, margenPct: 10 }).sugerencia, 25);
  });

  it('ignora los días sin ventas (festivos) y respeta el margen y las semanas configurables', () => {
    const s = calcularSugerencia(LUNES, ventas([30, 0, 31, 0, 50]), { semanas: 5, margenPct: 0 });
    assert.strictEqual(s.dias_con_datos, 3);
    assert.strictEqual(s.promedio, 37);
    assert.strictEqual(s.sugerencia, 37);
    assert.match(s.mensaje, /últimos 3 lunes: 37/);
  });

  it('con menos de 2 días comparables muestra "Aún no hay datos suficientes"', () => {
    const s = calcularSugerencia(LUNES, ventas([40, 0, 0, 0]), { semanas: 4, margenPct: 10 });
    assert.strictEqual(s.suficiente, false);
    assert.strictEqual(s.sugerencia, null);
    assert.strictEqual(s.mensaje, 'Aún no hay datos suficientes');
  });
});

describe('GET /api/menus/sugerencia', () => {
  const app = createApp();
  let encargado: UsuarioTest;
  let aprendiz: UsuarioTest;

  beforeAll(async () => {
    await cleanDatabase();
    encargado = await crearUsuario('Encargado Sugerencia', '8500000001', 'encargado');
    aprendiz = await crearUsuario('Aprendiz', '8500000002', 'aprendiz');
    const objetivo = '2026-11-16';
    // Dos lunes anteriores: 3 reservas + 2 invitados, y 4 reservas + 0 invitados
    for (const [semanas, reservas, invitados] of [
      [1, 3, 2],
      [2, 4, 0],
    ] as const) {
      const fecha = restarDias(objetivo, 7 * semanas);
      const menu = (
        await pool.query(
          "INSERT INTO menus_dia (fecha, nombre, precio_aprendiz, cantidad_disponible, estado) VALUES ($1, 'Menú', 5000, 50, 'completado') RETURNING id;",
          [fecha]
        )
      ).rows[0].id;
      for (let i = 0; i < reservas; i++) {
        const u = await crearUsuario(`Comensal ${semanas}-${i}`, `85${semanas}000000${i}`, 'aprendiz');
        await pool.query("INSERT INTO ventas (usuario_id, menu_id, precio_cobrado, estado) VALUES ($1, $2, 5000, 'completada');", [u.id, menu]);
      }
      if (invitados) {
        await pool.query(
          `INSERT INTO almuerzos_invitados (tipo, cantidad, precio_unitario, registrado_por, fecha_hora)
           VALUES ('corriente', $1, 11000, $2, ($3::date + time '12:00') AT TIME ZONE 'America/Bogota');`,
          [invitados, encargado.id, fecha]
        );
      }
    }
  });

  it('suma reservas e invitados del mismo día de la semana y usa la configuración', async () => {
    const res = await request(app).get('/api/menus/sugerencia?fecha=2026-11-16').set('Authorization', `Bearer ${encargado.token}`);
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.promedio, 4.5); // (5 + 4) / 2
    assert.strictEqual(res.body.sugerencia, 5); // 4,5 × 1,10 = 4,95 → 5
    assert.strictEqual(res.body.semanas, 4);
    assert.strictEqual(res.body.margen_pct, 10);
  });

  it('solo la ve el encargado', async () => {
    const res = await request(app).get('/api/menus/sugerencia').set('Authorization', `Bearer ${aprendiz.token}`);
    assert.strictEqual(res.status, 403);
  });
});
