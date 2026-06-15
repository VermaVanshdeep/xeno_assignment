import { pool } from './src/db/index';

async function fixNames() {
  console.log('Fixing hardcoded campaign names...');
  try {
    await pool.query(`UPDATE campaigns SET name = 'Retention Campaign — WhatsApp', message_template = 'Hi {{firstName}}, we have an exclusive offer just for you. Tap to explore.' WHERE name LIKE '%Monsoon%'`);
    await pool.query(`UPDATE campaigns SET name = 'Engagement Campaign — Email', message_template = 'Dear {{firstName}}, check out our latest collection tailored for you.' WHERE name LIKE '%Festive%'`);
    await pool.query(`UPDATE campaigns SET name = 'Winback Campaign — SMS', message_template = 'Hi {{firstName}}, we miss you! Here is a special discount for your next order.' WHERE name LIKE '%Win-Back%'`);
    console.log('Done!');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

fixNames();
