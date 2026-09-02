import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role'],
    credentials: true,
  })
);

app.use(express.json());

// Sesiones en memoria: token -> usuario (se pierden al reiniciar el servidor)
const sessions = new Map<string, (typeof mockUsers)[number]>();

// Base de datos en memoria para la demostración
const mockUsers = [
  {
    id: 'usr_seed_01',
    document: '1005678901',
    ficha: '2847251',
    name: 'Carlos Ruiz (Aprendiz SENA)',
    role: 'aprendiz',
    email: 'carlos.ruiz@misena.edu.co',
    password: 'demo123',
    status: 'ACTIVE',
  },
  {
    id: 'usr_seed_02',
    document: '1098765432',
    ficha: undefined,
    name: 'María Fernanda Gómez (Instructor SENA)',
    role: 'instructor',
    email: 'mgomez@sena.edu.co',
    password: 'demo123',
    status: 'ACTIVE',
  },
  {
    id: 'usr_seed_03',
    document: '1012345678',
    ficha: undefined,
    name: 'Encargado General Comedor',
    role: 'encargado',
    email: 'encargado@sena.edu.co',
    password: 'demo123',
    status: 'ACTIVE',
  },
];

const mockInstructores = [
  { id: 'inst_01', document: '1098765432', name: 'María Fernanda Gómez', email: 'mgomez@sena.edu.co' },
  { id: 'inst_02', document: '1085432190', name: 'Jorge Eduardo Martínez', email: 'jmartinez@sena.edu.co' },
  { id: 'inst_03', document: '1076543210', name: 'Diana Patricia Salazar', email: 'dsalazar@sena.edu.co' },
];

const mockInstituciones = [
  { id: 'inst_loc_01', nombre: 'Colegio San José', tipo: 'colegio', ciudad: 'Pitalito', activo: true },
  { id: 'inst_loc_02', nombre: 'Institución Educativa Yamboró', tipo: 'colegio', ciudad: 'Pitalito', activo: true },
  { id: 'inst_loc_03', nombre: 'Universidad Surcolombiana', tipo: 'universidad', ciudad: 'Neiva', activo: true },
];

const mockSugerencias: any[] = [
  {
    id: 'sug_01',
    usuario_id: 'usr_seed_01',
    usuario_nombre: 'Carlos Ruiz (Aprendiz SENA)',
    asunto: 'Sugerencia de Menú Vegetariano',
    mensaje: 'Sería excelente incluir una opción de proteína vegetal los días martes.',
    fecha: new Date(Date.now() - 3600000 * 2).toISOString(),
    estado: 'pendiente',
    respuesta: null,
  },
];

const activeMenu = {
  id: 'menu_dia_hoy',
  fecha: new Date().toISOString().split('T')[0],
  nombre: 'Menú Ejecutivo SENA',
  precio_aprendiz: 4500,
  precio_invitado: 12000,
  estado: 'activo',
};

const mockDeudas: any[] = [];
const mockVisitas: any[] = [];

interface AuthenticatedRequest extends Request {
  userRole?: string;
}

const requireRole = (allowedRole: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.headers['x-user-role'] as string;

    if (!role) {
      return res.status(401).json({
        message: 'No autenticado: falta el rol de usuario en la petición (header x-user-role).',
      });
    }

    if (role.toLowerCase() !== allowedRole.toLowerCase()) {
      return res.status(403).json({
        message: `Acceso Denegado: Esta acción requiere el rol de '${allowedRole.toUpperCase()}'. Tu rol actual es '${role}'.`,
      });
    }

    req.userRole = role;
    next();
  };
};

// --- ENDPOINT BUZÓN DE SUGERENCIAS ---
app.get('/api/sugerencias', (_req, res) => {
  return res.json(mockSugerencias);
});

app.post('/api/sugerencias', (req, res) => {
  const { asunto, mensaje } = req.body;
  if (!asunto || !mensaje) {
    return res.status(400).json({ message: 'Asunto y mensaje son obligatorios.' });
  }

  const nuevaSugerencia = {
    id: `sug_${Date.now()}`,
    usuario_id: 'usr_seed_01',
    usuario_nombre: 'Carlos Ruiz (Aprendiz SENA)',
    asunto: asunto.trim(),
    mensaje: mensaje.trim(),
    fecha: new Date().toISOString(),
    estado: 'pendiente',
    respuesta: null,
  };

  mockSugerencias.unshift(nuevaSugerencia);
  return res.status(201).json(nuevaSugerencia);
});

app.patch('/api/sugerencias/:id/responder', requireRole('encargado'), (req, res) => {
  const { id } = req.params;
  const { respuesta } = req.body;

  const sug = mockSugerencias.find((s) => s.id === id);
  if (!sug) {
    return res.status(404).json({ message: 'Sugerencia no encontrada.' });
  }

  sug.respuesta = respuesta;
  sug.estado = 'atendida';
  return res.json(sug);
});

// --- AUTH & RESTO DE ENDPOINTS ---
app.post('/api/auth/register', (req, res) => {
  const { name, document, accountType, ficha, email, password } = req.body;

  const nuevoUsuario = {
    id: `usr_reg_${Date.now()}`,
    document,
    ficha: accountType === 'aprendiz' ? ficha : undefined,
    name,
    role: accountType,
    email,
    password,
    status: 'ACTIVE',
  };

  mockUsers.push(nuevoUsuario);

  const token = `token_gastrosena_${Date.now()}`;
  sessions.set(token, nuevoUsuario);

  return res.status(201).json({
    token,
    user: nuevoUsuario,
    message: '¡Registro exitoso! Cuenta creada en la base de datos.',
  });
});

app.post('/api/auth/login', (req, res) => {
  const { accountType, document, password } = req.body;
  const userFound = mockUsers.find(
    (u) => u.document === document && u.password === password && u.role === accountType
  );

  if (!userFound) {
    return res.status(401).json({ message: 'Credenciales inválidas.' });
  }

  const token = `token_gastrosena_${userFound.id}`;
  sessions.set(token, userFound);

  return res.json({
    token,
    user: userFound,
    message: 'Inicio de sesión exitoso',
  });
});

app.post('/api/auth/facial-login', (req, res) => {
  const { document = '1005678901' } = req.body;
  const user = { ...mockUsers[0], document };

  const token = `token_facial_${Date.now()}`;
  sessions.set(token, user);

  return res.json({
    token,
    user,
    message: 'Autenticación biométrica exitosa',
  });
});

app.get('/api/auth/users', (_req, res) => {
  return res.json(mockUsers);
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
  const user = token ? sessions.get(token) : undefined;

  if (!user) {
    return res.status(401).json({ user: null, activeSession: false, message: 'Sesión no encontrada' });
  }

  return res.json({
    user,
    activeSession: true,
  });
});

app.get('/api/instructores', (_req, res) => res.json(mockInstructores));
app.get('/api/instituciones', requireRole('encargado'), (_req, res) => res.json(mockInstituciones));
app.post('/api/instituciones', requireRole('encargado'), (req, res) => {
  const nuevaInst = { id: `inst_${Date.now()}`, nombre: req.body.nombre, tipo: 'colegio', ciudad: 'Pitalito', activo: true };
  mockInstituciones.push(nuevaInst);
  return res.status(201).json(nuevaInst);
});

app.get('/api/visitas', requireRole('encargado'), (_req, res) => res.json(mockVisitas));
app.get('/api/visitas/kpi', requireRole('encargado'), (_req, res) => {
  return res.json({
    totalVisitasMes: mockVisitas.length,
    totalPersonasAtendidas: mockVisitas.reduce((acc, v) => acc + v.cantidad_personas, 0),
    ingresosVisitas: mockVisitas.reduce((acc, v) => acc + v.total_a_cobrar, 0),
  });
});

app.post('/api/visitas', requireRole('encargado'), (req, res) => {
  const { institucion_id, instructor_id, nombre_instructor_ext, cantidad_personas, fecha_visita } = req.body;
  const nuevaVisita = {
    id: `vis_${Date.now()}`,
    institucion_id,
    institucion_nombre: 'Institución de Prueba',
    instructor_id,
    nombre_instructor_ext,
    cantidad_personas: Number(cantidad_personas),
    fecha_visita,
    precio_unitario: 12000,
    total_a_cobrar: Number(cantidad_personas) * 12000,
    estado: 'programada',
    metodo_pago: 'efectivo',
    estado_pago: 'pendiente',
    created_at: new Date().toISOString(),
  };
  mockVisitas.unshift(nuevaVisita);
  return res.status(201).json(nuevaVisita);
});

// Endpoint de prueba de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', system: 'GastroSENA API', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server Express de GastroSENA escuchando en http://localhost:${PORT}`);
});