import { db } from './db/index';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('--- Query 1: SELECT COUNT(*) FROM communication_events ---');
    const q1 = await db.execute(sql`SELECT COUNT(*) FROM communication_events;`);
    console.log(JSON.stringify(q1.rows, null, 2));

    console.log('--- Query 1b: SELECT COUNT(*), status FROM communication_jobs GROUP BY status ---');
    const q1b = await db.execute(sql`SELECT COUNT(*), status FROM communication_jobs GROUP BY status;`);
    console.log(JSON.stringify(q1b.rows, null, 2));

    console.log('--- Query 1c: SELECT COUNT(*), status FROM campaigns GROUP BY status ---');
    const q1c = await db.execute(sql`SELECT COUNT(*), status FROM campaigns GROUP BY status;`);
    console.log(JSON.stringify(q1c.rows, null, 2));

    console.log('--- Query 1d: Other table counts ---');
    const custCount = await db.execute(sql`SELECT COUNT(*) FROM customers;`);
    const ordCount = await db.execute(sql`SELECT COUNT(*) FROM orders;`);
    const segCount = await db.execute(sql`SELECT COUNT(*) FROM segments;`);
    const audCount = await db.execute(sql`SELECT COUNT(*) FROM campaign_audience;`);
    console.log('Customers:', custCount.rows[0].count);
    console.log('Orders:', ordCount.rows[0].count);
    console.log('Segments:', segCount.rows[0].count);
    console.log('Campaign Audience:', audCount.rows[0].count);

    console.log('--- Query 1e: Campaigns list ---');
    const camps = await db.execute(sql`SELECT id, name, status, audience_size FROM campaigns;`);
    console.log(JSON.stringify(camps.rows, null, 2));

    console.log('--- Query 2: SELECT event_type, COUNT(*) FROM communication_events GROUP BY event_type ---');
    const q2 = await db.execute(sql`SELECT event_type, COUNT(*) FROM communication_events GROUP BY event_type;`);
    console.log(JSON.stringify(q2.rows, null, 2));

    console.log('--- Query 3: SELECT campaign_id, event_type, COUNT(*) FROM communication_events GROUP BY campaign_id, event_type ORDER BY campaign_id ---');
    const q3 = await db.execute(sql`SELECT campaign_id, event_type, COUNT(*) FROM communication_events GROUP BY campaign_id, event_type ORDER BY campaign_id;`);
    console.log(JSON.stringify(q3.rows, null, 2));

    console.log('--- Query 4: SELECT metadata_json->>\x27channel\x27 AS channel, COUNT(*) FROM communication_events GROUP BY metadata_json->>\x27channel\x27 ---');
    const q4 = await db.execute(sql`SELECT metadata_json->>'channel' AS channel, COUNT(*) FROM communication_events GROUP BY metadata_json->>'channel';`);
    console.log(JSON.stringify(q4.rows, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
main();
