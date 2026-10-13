import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const dbTest = await query('SELECT 1 as live;');
    const isLive = dbTest.rows.length > 0;

    return res.json({
      status: 'OK',
      database: isLive ? 'connected' : 'disconnected',
      system: 'GastroSENA API',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(503).json({
      status: 'DEGRADED',
      database: 'disconnected',
      error: error.message || 'Error al conectar con la base de datos',
      system: 'GastroSENA API',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
