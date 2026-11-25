import { pool } from '../../db/index.js';
import { CONFIGURACION_POR_DEFECTO } from '../../services/configuracion.service.js';

/**
 * Limpia las tablas en orden correcto (respetando FK constraints) antes de cada suite.
 * Usa el mismo pool que la app, que en NODE_ENV=test apunta a DATABASE_URL_TEST.
 */
export async function cleanDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      comprobantes_pago,
      auditoria,
      alertas,
      recordatorios_deuda,
      calificaciones_almuerzo,
      cierres_caja,
      beneficios,
      cargas_masivas,
      almuerzos_invitados,
      almuerzos_especiales,
      solicitudes_cuenta,
      pagos_deuda,
      movimientos_saldo,
      mermas,
      movimientos_kardex,
      receta_ingredientes,
      recetas,
      compra_detalle,
      compras,
      visitas_institucionales,
      ventas,
      deudas,
      sugerencias,
      menus_dia,
      reconocimiento_facial,
      usuarios,
      fichas,
      materiales,
      categorias_material,
      instituciones
    RESTART IDENTITY CASCADE;
  `);
  await restablecerConfiguracion();
}

/** Deja la configuración con sus valores por defecto (algunas pruebas la cambian). */
export async function restablecerConfiguracion(): Promise<void> {
  for (const [clave, valor] of Object.entries(CONFIGURACION_POR_DEFECTO)) {
    await pool.query(
      `INSERT INTO configuracion (clave, valor) VALUES ($1, $2::jsonb)
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;`,
      [clave, JSON.stringify(valor)]
    );
  }
}
