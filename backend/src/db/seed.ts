import bcrypt from 'bcryptjs';
import { query, pool } from './index.js';

export async function runSeed(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const forceSeed = process.env.SEED_DEMO === 'true';

  if (isProduction && !forceSeed) {
    console.warn(
      '[Seed] AVISO DE SEGURIDAD: Entorno de producción detectado y SEED_DEMO no está activo.'
    );
    console.warn('[Seed] No se insertarán usuarios demo con contraseñas predecibles en producción.');
    return;
  }

  console.log('[Seed] Iniciando inserción de datos de prueba en la base de datos...');

  const passwordHash = await bcrypt.hash('demo123', 10);
  const today = new Date().toISOString().split('T')[0];

  // 1. INSTRUCTORES Y ENCARGADOS BASE
  const instructor1Res = await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, activo)
     VALUES ($1, $2, $3, $4, 'instructor', true)
     ON CONFLICT (cedula) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id;`,
    ['María Fernanda Gómez (Instructor SENA)', '1098765432', 'mgomez@sena.edu.co', passwordHash]
  );
  const instructor1Id = instructor1Res.rows[0].id;

  const instructor2Res = await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, activo)
     VALUES ($1, $2, $3, $4, 'instructor', true)
     ON CONFLICT (cedula) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id;`,
    ['Jorge Eduardo Martínez', '1085432190', 'jmartinez@sena.edu.co', passwordHash]
  );
  const instructor2Id = instructor2Res.rows[0].id;

  const instructor3Res = await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, activo)
     VALUES ($1, $2, $3, $4, 'instructor', true)
     ON CONFLICT (cedula) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id;`,
    ['Diana Patricia Salazar', '1076543210', 'dsalazar@sena.edu.co', passwordHash]
  );
  const instructor3Id = instructor3Res.rows[0].id;

  const encargadoRes = await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, activo)
     VALUES ($1, $2, $3, $4, 'encargado', true)
     ON CONFLICT (cedula) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id;`,
    ['Encargado General Comedor', '1012345678', 'encargado@sena.edu.co', passwordHash]
  );
  const encargadoId = encargadoRes.rows[0].id;

  // 2. FICHAS / GRUPOS SENA
  const ficha1Res = await query(
    `INSERT INTO fichas (codigo_ficha, programa, instructor_id, vocero, jornada, cantidad_estudiantes)
     VALUES ($1, $2, $3, $4, 'mañana', 32)
     ON CONFLICT (codigo_ficha) DO UPDATE SET instructor_id = EXCLUDED.instructor_id
     RETURNING id;`,
    ['2847251', 'Análisis y Desarrollo de Software (ADSO)', instructor1Id, 'Carlos Ruiz']
  );
  const ficha1Id = ficha1Res.rows[0].id;

  await query(
    `INSERT INTO fichas (codigo_ficha, programa, instructor_id, vocero, jornada, cantidad_estudiantes)
     VALUES ($1, $2, $3, $4, 'mañana', 28)
     ON CONFLICT (codigo_ficha) DO NOTHING;`,
    ['2847252', 'Gestión Logística Integral', instructor2Id, 'Laura Benavides']
  );

  await query(
    `INSERT INTO fichas (codigo_ficha, programa, instructor_id, vocero, jornada, cantidad_estudiantes)
     VALUES ($1, $2, $3, $4, 'tarde', 30)
     ON CONFLICT (codigo_ficha) DO NOTHING;`,
    ['2847253', 'Mantenimiento Electrónico e Industrial', instructor3Id, 'Andrés Felipe Castro']
  );

  await query(
    `INSERT INTO fichas (codigo_ficha, programa, vocero, jornada, cantidad_estudiantes)
     VALUES ($1, $2, $3, 'mañana', 25)
     ON CONFLICT (codigo_ficha) DO NOTHING;`,
    ['2847254', 'Contabilidad y Finanzas Comercial', 'Valentina Morales']
  );

  await query(
    `INSERT INTO fichas (codigo_ficha, programa, vocero, jornada, cantidad_estudiantes)
     VALUES ($1, $2, $3, 'tarde', 35)
     ON CONFLICT (codigo_ficha) DO NOTHING;`,
    ['2847255', 'Gestión del Talento Humano', 'Diego Alexander Parra']
  );

  // 3. APRENDIZ Y INVITADO DEMO
  const aprendizRes = await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, ficha_id, saldo, codigo_qr, activo)
     VALUES ($1, $2, $3, $4, 'aprendiz', $5, 25000, 'QR_1005678901', true)
     ON CONFLICT (cedula) DO UPDATE SET ficha_id = EXCLUDED.ficha_id, password_hash = EXCLUDED.password_hash
     RETURNING id;`,
    ['Carlos Ruiz (Aprendiz SENA)', '1005678901', 'carlos.ruiz@misena.edu.co', passwordHash, ficha1Id]
  );
  const aprendizId = aprendizRes.rows[0].id;

  await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, activo)
     VALUES ($1, $2, $3, $4, 'invitado', true)
     ON CONFLICT (cedula) DO NOTHING;`,
    ['Invitado Particular', 'INV001', 'visitante@sena.edu.co', passwordHash]
  );

  // 4. MENÚ DEL DÍA ACTIVO
  const menuRes = await query(
    `INSERT INTO menus_dia (fecha, nombre, descripcion, precio_aprendiz, precio_invitado, cantidad_disponible, cantidad_vendida, imagen_url, estado, creado_por)
     VALUES ($1, $2, $3, 5000, 8000, 200, 45, '/cafeteria-bg.jpg', 'activo', $4)
     ON CONFLICT (fecha, nombre) DO UPDATE SET estado = 'activo'
     RETURNING id;`,
    [today, 'Menú Ejecutivo SENA', 'Almuerzo completo: Sopa, bandeja con proteína, arroz, ensalada, jugo natural y postre', encargadoId]
  );
  const menuId = menuRes.rows[0].id;

  // 5. INSTITUCIONES DEMO
  const inst1Res = await query(
    `INSERT INTO instituciones (nombre, tipo, ciudad, activo)
     VALUES ('Colegio San José', 'colegio', 'Pitalito', true)
     ON CONFLICT (nombre) DO UPDATE SET activo = true
     RETURNING id;`
  );
  const inst1Id = inst1Res.rows[0].id;

  await query(
    `INSERT INTO instituciones (nombre, tipo, ciudad, activo)
     VALUES ('Institución Educativa Yamboró', 'colegio', 'Pitalito', true)
     ON CONFLICT (nombre) DO NOTHING;`
  );

  await query(
    `INSERT INTO instituciones (nombre, tipo, ciudad, activo)
     VALUES ('Universidad Surcolombiana', 'universidad', 'Neiva', true)
     ON CONFLICT (nombre) DO NOTHING;`
  );

  // 6. VISITAS INSTITUCIONALES DEMO
  const checkVisita = await query('SELECT id FROM visitas_institucionales LIMIT 1;');
  if (checkVisita.rows.length === 0) {
    await query(
      `INSERT INTO visitas_institucionales (institucion_id, instructor_id, cantidad_personas, fecha_visita, precio_unitario, estado, metodo_pago, estado_pago, creado_por)
       VALUES ($1, $2, 25, $3, 8000, 'programada', 'efectivo', 'pendiente', $4);`,
      [inst1Id, instructor1Id, today, encargadoId]
    );
  }

  // 7. INVENTARIO (CATEGORÍAS Y MATERIALES)
  const catGranos = await query(
    `INSERT INTO categorias_material (nombre) VALUES ('Granos') ON CONFLICT (nombre) DO UPDATE SET nombre = 'Granos' RETURNING id;`
  );
  const catAceites = await query(
    `INSERT INTO categorias_material (nombre) VALUES ('Aceites') ON CONFLICT (nombre) DO UPDATE SET nombre = 'Aceites' RETURNING id;`
  );
  const catCarnes = await query(
    `INSERT INTO categorias_material (nombre) VALUES ('Carnes') ON CONFLICT (nombre) DO UPDATE SET nombre = 'Carnes' RETURNING id;`
  );
  const catVerduras = await query(
    `INSERT INTO categorias_material (nombre) VALUES ('Verduras') ON CONFLICT (nombre) DO UPDATE SET nombre = 'Verduras' RETURNING id;`
  );

  const matPolloRes = await query(
    `INSERT INTO materiales (codigo_barras, nombre, categoria_id, unidad_medida, costo_unitario, fecha_vencimiento, stock_actual, stock_minimo)
     VALUES ('770555444333', 'Pechuga de Pollo Fresca', $1, 'Kg', 14000, '2026-11-20', 28, 15)
     ON CONFLICT (codigo_barras) DO UPDATE SET stock_actual = 28 RETURNING id;`,
    [catCarnes.rows[0].id]
  );
  const matPolloId = matPolloRes.rows[0].id;

  const matArrozRes = await query(
    `INSERT INTO materiales (codigo_barras, nombre, categoria_id, unidad_medida, costo_unitario, fecha_vencimiento, stock_actual, stock_minimo)
     VALUES ('770123456789', 'Arroz Blanco Roa 1kg', $1, 'Kg', 3800, '2026-12-15', 45, 20)
     ON CONFLICT (codigo_barras) DO UPDATE SET stock_actual = 45 RETURNING id;`,
    [catGranos.rows[0].id]
  );
  const matArrozId = matArrozRes.rows[0].id;

  await query(
    `INSERT INTO materiales (codigo_barras, nombre, categoria_id, unidad_medida, costo_unitario, fecha_vencimiento, stock_actual, stock_minimo)
     VALUES ('770987654321', 'Aceite Vegetal Gourmet 1L', $1, 'Litros', 9500, '2026-10-30', 12, 10)
     ON CONFLICT (codigo_barras) DO UPDATE SET stock_actual = 12;`,
    [catAceites.rows[0].id]
  );

  await query(
    `INSERT INTO materiales (codigo_barras, nombre, categoria_id, unidad_medida, costo_unitario, fecha_vencimiento, stock_actual, stock_minimo)
     VALUES ('770222333444', 'Papa Pastusa', $1, 'Kg', 2500, '2026-11-10', 60, 30)
     ON CONFLICT (codigo_barras) DO UPDATE SET stock_actual = 60;`,
    [catVerduras.rows[0].id]
  );

  // 8. RECETAS DEMO
  const recetaRes = await query(
    `INSERT INTO recetas (codigo, nombre, costo_produccion, precio_venta, activa)
     VALUES ('REC-001', 'Bandeja con Pollo Sudado', 3200, 5000, true)
     ON CONFLICT (codigo) DO UPDATE SET nombre = 'Bandeja con Pollo Sudado' RETURNING id;`
  );
  const recetaId = recetaRes.rows[0].id;

  await query(
    `INSERT INTO receta_ingredientes (receta_id, material_id, cantidad, unidad, costo)
     VALUES ($1, $2, 0.25, 'Kg', 1800)
     ON CONFLICT (receta_id, material_id) DO NOTHING;`,
    [recetaId, matPolloId]
  );
  await query(
    `INSERT INTO receta_ingredientes (receta_id, material_id, cantidad, unidad, costo)
     VALUES ($1, $2, 0.15, 'Kg', 400)
     ON CONFLICT (receta_id, material_id) DO NOTHING;`,
    [recetaId, matArrozId]
  );

  // 9. MERMAS Y KARDEX DEMO
  const checkMermas = await query('SELECT id FROM mermas LIMIT 1;');
  if (checkMermas.rows.length === 0) {
    await query(
      `INSERT INTO mermas (material_id, cantidad_perdida, unidad, razon, registrado_por)
       VALUES ($1, 2.5, 'Kg', 'Deterioro por maduración extrema', $2);`,
      [matArrozId, encargadoId]
    );
  }

  // 10. DEUDAS DEMO PARA INSTRUCTORES
  const checkDeudas = await query('SELECT id FROM deudas LIMIT 1;');
  if (checkDeudas.rows.length === 0) {
    await query(
      `INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes, fecha_origen, estado)
       VALUES ($1, 15000, 3, CURRENT_DATE - INTERVAL '5 days', 'vencida');`,
      [instructor1Id]
    );
    await query(
      `INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes, fecha_origen, estado)
       VALUES ($1, 10000, 2, CURRENT_DATE - INTERVAL '2 days', 'pendiente');`,
      [instructor3Id]
    );
  }

  // 11. SUGERENCIAS DEMO
  const checkSugerencias = await query('SELECT id FROM sugerencias LIMIT 1;');
  if (checkSugerencias.rows.length === 0) {
    await query(
      `INSERT INTO sugerencias (usuario_id, ficha_id, asunto, mensaje, estado)
       VALUES ($1, $2, 'Sugerencia de Menú Vegetariano', 'Sería excelente incluir una opción de proteína vegetal los días martes.', 'pendiente');`,
      [aprendizId, ficha1Id]
    );
    await query(
      `INSERT INTO sugerencias (usuario_id, asunto, mensaje, estado)
       VALUES ($1, 'Horario de entrega de tickets para Instructores', 'Sugerimos agilizar la atención en caja entre las 12:00 PM y 12:30 PM.', 'pendiente');`,
      [instructor1Id]
    );
    await query(
      `INSERT INTO sugerencias (usuario_id, asunto, mensaje, estado, respuesta, atendida_por, atendida_en)
       VALUES ($1, 'Excelente sazón en la sopa del martes', 'Felicitaciones al equipo de cocina por la sopa del martes pasado.', 'atendida', '¡Muchas gracias por sus comentarios! Se transmitieron al personal de cocina.', $2, NOW());`,
      [aprendizId, encargadoId]
    );
  }

  // 12. CONSUMOS / VENTAS RECIENTES
  const checkVentas = await query('SELECT id FROM ventas LIMIT 1;');
  if (checkVentas.rows.length === 0) {
    for (let i = 0; i < 5; i++) {
      await query(
        `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, metodo_verificacion, registrado_por, estado)
         VALUES ($1, $2, NOW() - ($3 || ' days')::INTERVAL, 5000, 'saldo', 'manual', $4, 'completada');`,
        [aprendizId, menuId, i, encargadoId]
      );
      await query(
        `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, metodo_verificacion, registrado_por, estado)
         VALUES ($1, $2, NOW() - ($3 || ' days')::INTERVAL, 5000, 'credito', 'manual', $4, 'completada');`,
        [instructor1Id, menuId, i, encargadoId]
      );
    }
  }

  console.log('[Seed] ✓ Datos de demostración cargados exitosamente.');
}

// Ejecutar directamente si se invoca como script
const isMain = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isMain) {
  runSeed()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[Seed] Error al sembrar datos demo:', err);
      try {
        await pool.end();
      } catch (_) {}
      process.exit(1);
    });
}
