import { pool } from './src/db/index';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const sqlPath = path.join(__dirname, 'drizzle', 'add_campaign_metadata.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('Running migration...');
  try {
    await pool.query(sql);
    console.log('Migration successful!');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    process.exit(0);
  }
}

runMigration();
