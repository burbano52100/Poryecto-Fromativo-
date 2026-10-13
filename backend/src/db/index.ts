import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gastrosena';

const isProduction = process.env.NODE_ENV === 'production';
const requiresSSL =
  connectionString.includes('sslmode=require') ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('supabase.co') ||
  (isProduction && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1'));

export const pool = new Pool({
  connectionString,
  ssl: requiresSSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB Pool] Error inesperado en cliente inactivo de PostgreSQL:', err);
});

export const query = async <T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> => {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL === 'true') {
    console.log('[DB Query]', { text, duration: `${duration}ms`, rows: res.rowCount });
  }
  return res;
};

export const getClient = async (): Promise<pg.PoolClient> => {
  return await pool.connect();
};

export default {
  pool,
  query,
  getClient,
};
