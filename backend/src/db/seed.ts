import bcrypt from 'bcryptjs';
import { query, pool } from './index.js';
import { recalcularReceta, registrarMerma, withTransaction } from '../services/inventario.service.js';
import { fechaBogota } from '../utils/horario.js';
import { TARIFAS_ALMUERZO_INVITADO, type TipoAlmuerzoInvitado } from '../config/almuerzosInvitados.js';
import { restarDias } from '../utils/rango.js';
import { resumenDia } from '../services/cierreCaja.service.js';

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
  // "Hoy" en Colombia: con la fecha UTC, después de las 7 p. m. se creaba el menú de mañana
  const today = fechaBogota();

  // 1. INSTRUCTORES Y ENCARGADOS BASE
  const instructor1Res = await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, estado)
     VALUES ($1, $2, $3, $4, 'instructor', 'activo')
     ON CONFLICT (cedula) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id;`,
    ['María Fernanda Gómez (Instructor SENA)', '1098765432', 'mgomez@sena.edu.co', passwordHash]
  );
  const instructor1Id = instructor1Res.rows[0].id;

  const instructor2Res = await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, estado)
     VALUES ($1, $2, $3, $4, 'instructor', 'activo')
     ON CONFLICT (cedula) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id;`,
    ['Jorge Eduardo Martínez', '1085432190', 'jmartinez@sena.edu.co', passwordHash]
  );
  const instructor2Id = instructor2Res.rows[0].id;

  const instructor3Res = await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, estado)
     VALUES ($1, $2, $3, $4, 'instructor', 'activo')
     ON CONFLICT (cedula) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id;`,
    ['Diana Patricia Salazar', '1076543210', 'dsalazar@sena.edu.co', passwordHash]
  );
  const instructor3Id = instructor3Res.rows[0].id;

  const encargadoRes = await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, estado)
     VALUES ($1, $2, $3, $4, 'encargado', 'activo')
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

  // 3. APRENDIZ DEMO
  const aprendizRes = await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, ficha_id, saldo, codigo_qr, estado)
     VALUES ($1, $2, $3, $4, 'aprendiz', $5, 25000, 'QR_1005678901', 'activo')
     ON CONFLICT (cedula) DO UPDATE SET ficha_id = EXCLUDED.ficha_id, password_hash = EXCLUDED.password_hash
     RETURNING id;`,
    ['Carlos Ruiz (Aprendiz SENA)', '1005678901', 'carlos.ruiz@misena.edu.co', passwordHash, ficha1Id]
  );
  const aprendizId = aprendizRes.rows[0].id;

  // 3b. COORDINADOR (ADR 018): lo crea el equipo, no se auto-registra
  const coordinadorRes = await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, estado)
     VALUES ('Coordinadora Académica Yamboró', '1023456789', 'coordinacion@sena.edu.co', $1, 'coordinador', 'activo')
     ON CONFLICT (cedula) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = 'coordinador', estado = 'activo'
     RETURNING id;`,
    [passwordHash]
  );
  const coordinadorId = coordinadorRes.rows[0].id;

  // 3c. SOLICITUDES PENDIENTES para la bandeja del coordinador: dos instructores y un aprendiz que
  //     se registraron solos, y una cuenta rechazada (su login muestra el motivo)
  const ficha2Id = (await query("SELECT id FROM fichas WHERE codigo_ficha = '2847252';")).rows[0].id;
  for (const [nombre, cedula, email, rol, fichaId, estado, motivo] of [
    ['Luis Alberto Pérez', '1065432101', 'lperez@sena.edu.co', 'instructor', null, 'pendiente', null],
    ['Sandra Milena Torres', '1054321098', 'storres@sena.edu.co', 'instructor', null, 'pendiente', null],
    ['Camila Andrea Ortiz', '1005678910', 'camila.ortiz@misena.edu.co', 'aprendiz', ficha2Id, 'pendiente', null],
    ['Ricardo Gómez Vargas', '1043210987', 'rgomez@correo.com', 'instructor', null, 'rechazado', 'No figura en la planta de instructores del centro'],
  ] as const) {
    await query(
      `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, ficha_id, estado, origen, motivo_rechazo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'registro', $8)
       ON CONFLICT (cedula) DO NOTHING;`,
      [nombre, cedula, email, passwordHash, rol, fichaId, estado, motivo]
    );
  }

  // 3d. CUENTA CREADA POR CARGA MASIVA: entra con su cédula como contraseña y debe cambiarla
  await query(
    `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, ficha_id, estado, origen, debe_cambiar_clave, aprobado_por, fecha_aprobacion)
     VALUES ('Valeria Muñoz Cárdenas', '1005678920', 'valeria.munoz@misena.edu.co', $1, 'aprendiz', $2, 'activo', 'carga_masiva', true, $3, NOW())
     ON CONFLICT (cedula) DO NOTHING;`,
    [await bcrypt.hash('1005678920', 10), ficha1Id, coordinadorId]
  );

  // 3e. APRENDICES DE LA FICHA 2847251 que alimentan el historial de ventas, la sugerencia de
  //     preparación, los cierres de caja y las calificaciones (contraseña demo123)
  const comensales: string[] = [];
  for (let n = 0; n < 12; n++) {
    const cedula = `10056789${30 + n}`;
    const res = await query(
      `INSERT INTO usuarios (nombre, cedula, email, password_hash, rol, ficha_id, estado)
       VALUES ($1, $2, $3, $4, 'aprendiz', $5, 'activo')
       ON CONFLICT (cedula) DO UPDATE SET ficha_id = EXCLUDED.ficha_id
       RETURNING id;`,
      [`Aprendiz Demo ${String(n + 1).padStart(2, '0')}`, cedula, `aprendiz${n + 1}@misena.edu.co`, passwordHash, ficha1Id]
    );
    comensales.push(res.rows[0].id);
  }

  // 4. MENÚ DEL DÍA ACTIVO
  const menuRes = await query(
    `INSERT INTO menus_dia (fecha, nombre, descripcion, precio_aprendiz, cantidad_disponible, cantidad_vendida, imagen_url, estado, creado_por)
     VALUES ($1, $2, $3, 5000, 200, 0, '/cafeteria-bg.jpg', 'activo', $4)
     ON CONFLICT (fecha, nombre) DO UPDATE SET estado = 'activo', precio_aprendiz = 5000
     RETURNING id;`,
    [today, 'Menú Ejecutivo SENA', 'Almuerzo completo: Sopa, bandeja con proteína, arroz, ensalada, jugo natural y postre', encargadoId]
  );
  const menuId = menuRes.rows[0].id;

  // Asegurar precio correcto de $5.000 si existía precio previo desactualizado
  await query("UPDATE menus_dia SET precio_aprendiz = 5000 WHERE precio_aprendiz = 3500;");

  // 5. INSTITUCIONES DEMO
  await query(
    `INSERT INTO instituciones (nombre, tipo, ciudad, activo)
     VALUES ('Colegio San José', 'colegio', 'Pitalito', true)
     ON CONFLICT (nombre) DO UPDATE SET activo = true;`
  );

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
      `INSERT INTO visitas_institucionales (institucion_nombre, responsable_nombre, cantidad_personas, fecha_visita, precio_unitario, estado, metodo_pago, estado_pago, creado_por)
       VALUES ('Colegio San José', 'María Fernanda Gómez', 25, $1, $2, 'programada', 'efectivo', 'pendiente', $3);`,
      [today, TARIFAS_ALMUERZO_INVITADO.corriente, encargadoId]
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

  // Vencimientos relativos a hoy para que la demo no quede con productos vencidos con el paso de los días
  // (la papa vence pronto a propósito, para mostrar el estado "Venciendo")
  const matPolloRes = await query(
    `INSERT INTO materiales (codigo_barras, nombre, categoria_id, unidad_medida, costo_unitario, fecha_vencimiento, stock_actual, stock_minimo)
     VALUES ('770555444333', 'Pechuga de Pollo Fresca', $1, 'Kg', 14000, $2::date + 16, 28, 15)
     ON CONFLICT (codigo_barras) DO UPDATE SET codigo_barras = EXCLUDED.codigo_barras RETURNING id;`,
    [catCarnes.rows[0].id, today]
  );
  const matPolloId = matPolloRes.rows[0].id;

  const matArrozRes = await query(
    `INSERT INTO materiales (codigo_barras, nombre, categoria_id, unidad_medida, costo_unitario, fecha_vencimiento, stock_actual, stock_minimo)
     VALUES ('770123456789', 'Arroz Blanco Roa 1kg', $1, 'Kg', 3800, $2::date + 41, 45, 20)
     ON CONFLICT (codigo_barras) DO UPDATE SET codigo_barras = EXCLUDED.codigo_barras RETURNING id;`,
    [catGranos.rows[0].id, today]
  );
  const matArrozId = matArrozRes.rows[0].id;

  await query(
    `INSERT INTO materiales (codigo_barras, nombre, categoria_id, unidad_medida, costo_unitario, fecha_vencimiento, stock_actual, stock_minimo)
     VALUES ('770987654321', 'Aceite Vegetal Gourmet 1L', $1, 'Litros', 9500, $2::date + 120, 12, 10)
     ON CONFLICT (codigo_barras) DO UPDATE SET codigo_barras = EXCLUDED.codigo_barras;`,
    [catAceites.rows[0].id, today]
  );

  await query(
    `INSERT INTO materiales (codigo_barras, nombre, categoria_id, unidad_medida, costo_unitario, fecha_vencimiento, stock_actual, stock_minimo)
     VALUES ('770222333444', 'Papa Pastusa', $1, 'Kg', 2500, $2::date + 5, 60, 30)
     ON CONFLICT (codigo_barras) DO UPDATE SET codigo_barras = EXCLUDED.codigo_barras;`,
    [catVerduras.rows[0].id, today]
  );

  // Saldo inicial en el kardex para los materiales que aún no tienen movimientos
  await query(
    `INSERT INTO movimientos_kardex (material_id, tipo, concepto, cantidad_entrada, saldo_resultante, referencia_tipo)
     SELECT m.id, 'entrada', 'Saldo inicial', m.stock_actual, m.stock_actual, 'seed'
     FROM materiales m
     WHERE NOT EXISTS (SELECT 1 FROM movimientos_kardex k WHERE k.material_id = m.id);`
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
  // El costo de cada ingrediente y de la receta se calcula desde el costo unitario de los materiales
  await recalcularReceta(pool, recetaId);

  // 9. MERMAS Y KARDEX DEMO
  const checkMermas = await query('SELECT id FROM mermas LIMIT 1;');
  if (checkMermas.rows.length === 0) {
    await withTransaction((client) =>
      registrarMerma(client, {
        materialId: matArrozId,
        cantidad: 2.5,
        razon: 'Deterioro por maduración extrema',
        usuarioId: encargadoId,
      })
    );
  }

  // 10. SUGERENCIAS DEMO
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

  // 11. CONSUMOS / VENTAS RECIENTES (hoy y los 4 días anteriores, en hora de Colombia)
  const checkVentas = await query('SELECT id FROM ventas LIMIT 1;');
  if (checkVentas.rows.length === 0) {
    for (let i = 0; i < 5; i++) {
      let currentMenuId = menuId;
      if (i > 0) {
        const pastMenuRes = await query(
          `INSERT INTO menus_dia (fecha, nombre, descripcion, precio_aprendiz, cantidad_disponible, cantidad_vendida, imagen_url, estado, creado_por)
           VALUES ($1::date - $2::int, 'Menú del Día - ' || $2, 'Almuerzo completo tradicional SENA', 5000, 200, 0, '/cafeteria-bg.jpg', 'completado', $3)
           ON CONFLICT (fecha, nombre) DO UPDATE SET precio_aprendiz = 5000 RETURNING id;`,
          [today, i, encargadoId]
        );
        currentMenuId = pastMenuRes.rows[0].id;
      }

      // La venta queda el mismo día del menú, a las 12:30 en Colombia (o ahora, si hoy aún no es esa hora)
      const fechaHora = `LEAST(NOW(), (($3::date - $4::int) + TIME '12:30') AT TIME ZONE 'America/Bogota')`;
      // Aprendiz: pagó en la ventanilla (ADR 011)
      await query(
        `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, estado_pago, metodo_verificacion, registrado_por, estado)
         VALUES ($1, $2, ${fechaHora}, 5000, 'efectivo', 'pagado', 'manual', $5, 'completada')
         ON CONFLICT DO NOTHING;`,
        [aprendizId, currentMenuId, today, i, encargadoId]
      );
      // Instructora: a crédito, se cobra en Cartera de Deudas
      await query(
        `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, estado_pago, metodo_verificacion, registrado_por, estado)
         VALUES ($1, $2, ${fechaHora}, 5000, 'credito', 'pendiente', 'manual', $5, 'completada')
         ON CONFLICT DO NOTHING;`,
        [instructor1Id, currentMenuId, today, i, encargadoId]
      );
    }
  }

  // 12. DEUDAS DE INSTRUCTORES: salen de sus ventas a crédito pendientes, igual que cuando
  //     el instructor reserva en la app (antes eran montos fijos que no cuadraban con Ventas)
  const checkDeudas = await query('SELECT id FROM deudas LIMIT 1;');
  if (checkDeudas.rows.length === 0) {
    await query(
      `INSERT INTO deudas (usuario_id, monto, almuerzos_pendientes, fecha_origen, estado)
       SELECT v.usuario_id, SUM(v.precio_cobrado), COUNT(*)::int,
              MIN((v.fecha_hora AT TIME ZONE 'America/Bogota')::date), 'pendiente'
       FROM ventas v
       JOIN usuarios u ON u.id = v.usuario_id
       WHERE u.rol = 'instructor' AND v.estado = 'completada' AND v.estado_pago = 'pendiente'
       GROUP BY v.usuario_id;`
    );
  }

  // 13. ALMUERZOS INVITADOS (ADR 016): registros del encargado de hoy y de los 2 días anteriores,
  //     con la tarifa vigente de cada tipo
  const checkInvitados = await query('SELECT id FROM almuerzos_invitados LIMIT 1;');
  if (checkInvitados.rows.length === 0) {
    const registros: { diasAtras: number; hora: string; tipo: TipoAlmuerzoInvitado; personas: number; nombre: string | null }[] = [
      { diasAtras: 0, hora: '12:10', tipo: 'instructor', personas: 2, nombre: 'Instructores visitantes SENA Neiva' },
      { diasAtras: 0, hora: '12:25', tipo: 'aprendiz', personas: 3, nombre: null },
      { diasAtras: 0, hora: '12:40', tipo: 'corriente', personas: 1, nombre: 'Proveedor de verduras' },
      { diasAtras: 1, hora: '12:15', tipo: 'aprendiz', personas: 4, nombre: 'Aprendices de intercambio' },
      { diasAtras: 1, hora: '12:50', tipo: 'corriente', personas: 2, nombre: null },
      { diasAtras: 2, hora: '12:30', tipo: 'instructor', personas: 1, nombre: null },
    ];
    for (const r of registros) {
      // Como en las ventas: a esa hora en Colombia, o ahora si hoy todavía no es esa hora
      await query(
        `INSERT INTO almuerzos_invitados (tipo, cantidad, precio_unitario, nombre_invitado, registrado_por, fecha_hora)
         VALUES ($1, $2, $3, $4, $5,
                 LEAST(NOW(), (($6::date - $7::int) + $8::time) AT TIME ZONE 'America/Bogota'));`,
        [r.tipo, r.personas, TARIFAS_ALMUERZO_INVITADO[r.tipo], r.nombre, encargadoId, today, r.diasAtras, r.hora]
      );
    }
  }

  // 13b. EL MENÚ DE HOY DESCUENTA INVENTARIO CON SU RECETA (ADR 020)
  await query('UPDATE menus_dia SET receta_id = $1 WHERE id = $2 AND receta_id IS NULL;', [recetaId, menuId]);

  // 13c. BENEFICIARIOS (ADR 019): dos activos (almuerzo a $0) y uno finalizado para el historial
  const checkBeneficios = await query('SELECT id FROM beneficios LIMIT 1;');
  if (checkBeneficios.rows.length === 0) {
    await query(
      `INSERT INTO beneficios (usuario_id, estado, fecha_inicio, fecha_fin, prioridad, sin_apoyo_incompatible, creado_por)
       VALUES ($1, 'activo', $3::date - 60, $3::date + 60, 1, true, $4),
              ($2, 'activo', $3::date - 45, NULL, 2, true, $4);`,
      [comensales[0], comensales[1], today, encargadoId]
    );
    await query(
      `INSERT INTO beneficios (usuario_id, estado, fecha_inicio, fecha_fin, prioridad, sin_apoyo_incompatible, creado_por,
                               motivo_fin, detalle_fin, fecha_finalizacion, finalizado_por)
       VALUES ($1, 'finalizado', $2::date - 90, $2::date - 20, 1, true, $3, 'inasistencias',
               'Faltó a más de 5 almuerzos reservados', NOW() - interval '20 days', $3);`,
      [comensales[2], today, encargadoId]
    );
  }

  // 13d. HISTORIAL DE 5 SEMANAS (lunes a sábado) para la sugerencia de preparación: cada día de la
  //      semana tiene su propia demanda, y algunos invitados. Las reservas de los beneficiarios van a $0.
  const checkHistorial = await query("SELECT 1 FROM menus_dia WHERE nombre = 'Menú del Día - 30';");
  if (checkHistorial.rows.length === 0) {
    const DEMANDA_POR_DIA = [0, 9, 8, 10, 8, 7, 4]; // domingo … sábado
    for (let i = 1; i <= 35; i++) {
      const fecha = restarDias(today, i);
      const [anio, mes, dia] = fecha.split('-').map(Number);
      const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
      if (diaSemana === 0) continue; // el comedor no abre los domingos
      const menuDia = await query(
        `INSERT INTO menus_dia (fecha, nombre, descripcion, precio_aprendiz, cantidad_disponible, cantidad_vendida, imagen_url, estado, creado_por)
         VALUES ($1, 'Menú del Día - ' || $2, 'Almuerzo completo tradicional SENA', 5000, 200, 0, '/cafeteria-bg.jpg', 'completado', $3)
         ON CONFLICT (fecha, nombre) DO UPDATE SET precio_aprendiz = 5000 RETURNING id;`,
        [fecha, i, encargadoId]
      );
      const reservas = Math.min(comensales.length, DEMANDA_POR_DIA[diaSemana] + (i % 3) - 1);
      for (let n = 0; n < reservas; n++) {
        const beneficiario = n < 2;
        await query(
          `INSERT INTO ventas (usuario_id, menu_id, fecha_hora, precio_cobrado, metodo_pago, estado_pago, metodo_verificacion, estado)
           VALUES ($1, $2, ($3::date + TIME '11:45' + make_interval(mins => $4)) AT TIME ZONE 'America/Bogota', $5, $6, $7, 'manual', 'completada')
           ON CONFLICT DO NOTHING;`,
          [comensales[n], menuDia.rows[0].id, fecha, n * 3, beneficiario ? 0 : 5000, beneficiario ? 'cortesia' : 'efectivo', beneficiario ? 'gratis' : 'pagado']
        );
      }
      if (diaSemana !== 6 && i > 2) {
        const tipo: TipoAlmuerzoInvitado = (['instructor', 'aprendiz', 'corriente'] as const)[i % 3];
        await query(
          `INSERT INTO almuerzos_invitados (tipo, cantidad, precio_unitario, registrado_por, fecha_hora)
           VALUES ($1, $2, $3, $4, ($5::date + TIME '12:20') AT TIME ZONE 'America/Bogota');`,
          [tipo, 1 + (i % 2), TARIFAS_ALMUERZO_INVITADO[tipo], encargadoId, fecha]
        );
      }
    }
  }

  // 13e. CALIFICACIONES DEL ALMUERZO (ADR 022) de las últimas dos semanas, con algunas bajas
  const checkCalificaciones = await query('SELECT id FROM calificaciones_almuerzo LIMIT 1;');
  if (checkCalificaciones.rows.length === 0) {
    const ESTRELLAS = [5, 4, 4, 3, 5, 2, 4, 5, 1, 4];
    const COMENTARIOS: Record<number, string> = {
      1: 'El arroz estaba crudo y la porción muy pequeña.',
      2: 'La sopa llegó fría.',
      5: '¡Excelente sazón, gracias!',
    };
    const vendidas = await query(
      `SELECT v.usuario_id, v.menu_id, (($1::date) - m.fecha) AS dias
       FROM ventas v JOIN menus_dia m ON m.id = v.menu_id
       WHERE v.estado = 'completada' AND m.fecha BETWEEN $1::date - 14 AND $1::date - 1
       ORDER BY m.fecha, v.usuario_id;`,
      [today]
    );
    for (const [n, v] of vendidas.rows.entries()) {
      if (n % 2 === 1) continue; // la mitad de los comensales califica
      const estrellas = ESTRELLAS[(n + Number(v.dias)) % ESTRELLAS.length];
      await query(
        `INSERT INTO calificaciones_almuerzo (menu_id, usuario_id, estrellas, comentario, fecha_hora)
         VALUES ($1, $2, $3, $4, NOW() - make_interval(days => $5))
         ON CONFLICT ON CONSTRAINT unq_calificacion_menu_usuario DO NOTHING;`,
        [v.menu_id, v.usuario_id, estrellas, COMENTARIOS[estrellas] ?? null, Number(v.dias)]
      );
    }
  }

  // 13f. VISITAS: una pasada sin confirmar ("Por confirmar"), una realizada y una futura
  const checkVisitasDemo = await query("SELECT 1 FROM visitas_institucionales WHERE institucion_nombre = 'Universidad Surcolombiana';");
  if (checkVisitasDemo.rows.length === 0) {
    await query(
      `INSERT INTO visitas_institucionales (institucion_nombre, responsable_nombre, cantidad_personas, fecha_visita, precio_unitario,
                                            estado, metodo_pago, estado_pago, creado_por, fecha_hora_realizada, confirmada_por)
       VALUES ('Institución Educativa Yamboró', 'Rector Hernán Silva', 30, $1::date - 6, $2, 'programada', 'efectivo', 'pendiente', $3, NULL, NULL),
              ('Universidad Surcolombiana', 'Docente Paola Rincón', 18, $1::date - 3, $2, 'realizada', 'transferencia', 'pagado', $3,
               NOW() - interval '3 days', $3),
              ('Colegio Departamental La Laguna', 'Coordinador Iván Muñoz', 40, $1::date + 7, $2, 'programada', 'efectivo', 'pendiente', $3, NULL, NULL);`,
      [today, TARIFAS_ALMUERZO_INVITADO.corriente, encargadoId]
    );
  }

  // 14. PORCIONES VENDIDAS = ventas completadas de cada menú. La app mantiene esa igualdad al
  //     reservar; aquí se recalcula también para corregir bases sembradas con versiones anteriores.
  await query(
    `UPDATE menus_dia m
     SET cantidad_vendida = c.vendidas
     FROM (
       SELECT m2.id, COUNT(v.id)::int AS vendidas
       FROM menus_dia m2
       LEFT JOIN ventas v ON v.menu_id = m2.id AND v.estado = 'completada'
       GROUP BY m2.id
     ) c
     WHERE c.id = m.id AND m.cantidad_vendida <> c.vendidas;`
  );

  // 15. CIERRES DE CAJA (ADR 021) de los 6 días hábiles anteriores a hoy (sin domingos, cuando el
  //     comedor no abre), con el resumen real de cada día; el más reciente reabierto y el siguiente
  //     con un faltante para mostrar el historial. Un cierre por fecha: si ya existe, se respeta.
  const diasConCierre: string[] = [];
  for (let i = 1; diasConCierre.length < 6; i++) {
    const fecha = restarDias(today, i);
    const [anio, mes, dia] = fecha.split('-').map(Number);
    if (new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay() !== 0) diasConCierre.push(fecha);
  }
  for (const [n, fecha] of diasConCierre.entries()) {
    const reabierto = n === 0;
    const conFaltante = n === 1;
    const resumen = await resumenDia(fecha);
    const faltante = conFaltante ? Math.min(5000, resumen.ingresos_esperados) : 0;
    await query(
      `INSERT INTO cierres_caja (fecha, almuerzos_aprendices, almuerzos_beneficiarios, almuerzos_instructores,
         almuerzos_invitados_instructores, almuerzos_invitados_aprendices, almuerzos_invitados_corrientes,
         ingresos_esperados, ingresos_recibidos, detalle, observaciones, cerrado_por, estado, fecha_hora_cierre,
         reabierto_por, fecha_hora_reapertura, motivo_reapertura)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13,
               ($1::date + TIME '15:30') AT TIME ZONE 'America/Bogota', $14, $15, $16)
       ON CONFLICT (fecha) DO NOTHING;`,
      [
        fecha,
        resumen.almuerzos.aprendices,
        resumen.almuerzos.beneficiarios,
        resumen.almuerzos.instructores,
        resumen.almuerzos.invitados_instructores,
        resumen.almuerzos.invitados_aprendices,
        resumen.almuerzos.invitados_corrientes,
        resumen.ingresos_esperados,
        resumen.ingresos_esperados - faltante,
        JSON.stringify(resumen.ingresos),
        faltante > 0 ? 'Faltó el pago de un aprendiz; se cobrará mañana.' : null,
        encargadoId,
        reabierto ? 'reabierto' : 'cerrado',
        reabierto ? encargadoId : null,
        reabierto ? new Date() : null,
        reabierto ? 'Se registró tarde un almuerzo invitado del mediodía' : null,
      ]
    );
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
      } catch {}
      process.exit(1);
    });
}
