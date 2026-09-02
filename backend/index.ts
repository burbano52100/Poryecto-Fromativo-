import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';

// 1. CONEXIÓN BACKEND-FRONTEND (CORS solo para origen local)
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json());

// Sesiones en memoria: token -> usuario (se pierden al reiniciar el servidor)
const sessions = new Map<string, (typeof mockUsers)[number]>();

// Base de datos en memoria para la demostración
const mockUsers = [
  {
    id: 'usr_01',
    document: '1005678901',
    ficha: '2847251',
    name: 'Carlos Ruiz',
    role: 'aprendiz',
    email: 'cruiz@misena.edu.co',
    status: 'ACTIVE',
  },
  {
    id: 'usr_02',
    document: '1098765432',
    ficha: '2847251',
    name: 'María Fernanda Gómez',
    role: 'instructor',
    email: 'mgomez@sena.edu.co',
    status: 'ACTIVE',
  },
];

// Endpoints de Autenticación
app.post('/api/auth/login', (req, res) => {
  const { accountType, ficha, document, password } = req.body;

  // Validación básica del servidor
  if (!document || !password) {
    return res.status(400).json({ message: 'Documento y contraseña son obligatorios' });
  }

  if (accountType === 'aprendiz' && !ficha) {
    return res.status(400).json({ message: 'El ID de Ficha es obligatorio para Aprendices' });
  }

  // Simulación de usuario autenticado
  const user = mockUsers.find((u) => u.document === document) || {
    id: `usr_${Date.now()}`,
    document,
    ficha: ficha || 'N/A',
    name: accountType === 'aprendiz' ? 'Aprendiz SENA' : accountType === 'instructor' ? 'Instructor SENA' : 'Encargado Comedor',
    role: accountType,
    email: `${document}@misena.edu.co`,
    status: 'ACTIVE',
  };

  const token = `token_gastrosena_${Date.now()}`;
  sessions.set(token, user);

  return res.json({
    token,
    user,
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

// Endpoint de prueba de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', system: 'GastroSENA API', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server Express de GastroSENA escuchando en http://localhost:${PORT}`);
  console.log(`🔒 CORS habilitado para: ${FRONTEND_ORIGIN}`);
});
