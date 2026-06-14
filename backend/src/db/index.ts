import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function getSafeConnectionString(connStr: string | undefined): string | undefined {
  if (!connStr) return connStr;
  const protocolIdx = connStr.indexOf('://');
  if (protocolIdx === -1) return connStr;
  
  const protocol = connStr.substring(0, protocolIdx + 3);
  const rest = connStr.substring(protocolIdx + 3);
  
  const lastAtIdx = rest.lastIndexOf('@');
  if (lastAtIdx === -1) return connStr;
  
  const credentials = rest.substring(0, lastAtIdx);
  const hostPart = rest.substring(lastAtIdx + 1);
  
  const colonIdx = credentials.indexOf(':');
  if (colonIdx === -1) return connStr;
  
  const user = credentials.substring(0, colonIdx);
  const pass = credentials.substring(colonIdx + 1);
  
  const encodedPass = pass.includes('@') && !pass.includes('%40') ? encodeURIComponent(pass) : pass;
  return `${protocol}${user}:${encodedPass}@${hostPart}`;
}

export const pool = new pg.Pool({
  connectionString: getSafeConnectionString(process.env.DATABASE_URL),
});

export const db = drizzle(pool, { schema });
export default db;
