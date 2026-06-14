/**
 * seed_analytics.ts — CRM Analytics Seeding Script
 *
 * Creates 3 named campaigns with realistic communication events
 * spanning the last 6 months using existing customer records.
 *
 * Run with: npm run seed:analytics
 * Does NOT wipe existing customers or orders.
 */

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

const connectionString = getSafeConnectionString(process.env.DATABASE_URL);
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const db = drizzle(pool, { schema });

// Channel outcome probability models (mirrors channelService.ts)
const PROBABILITIES = {
  WHATSAPP: { delivered: 0.98, read: 0.92, clicked: 0.18 },
  SMS:      { delivered: 0.95, read: 0.70, clicked: 0.08 },
  EMAIL:    { delivered: 0.90, read: 0.35, clicked: 0.12 },
  RCS:      { delivered: 0.96, read: 0.80, clicked: 0.15 },
};

const CATEGORIES = ['Fashion', 'Beauty', 'Coffee', 'Lifestyle', 'Electronics'];

/** Simulate communication events for a single job/customer */
function simulateEvents(
  campaignId: string,
  customerId: string,
  channel: keyof typeof PROBABILITIES,
  baseTime: Date
): Array<typeof schema.communicationEvents.$inferInsert> {
  const prob = PROBABILITIES[channel];
  const events: Array<typeof schema.communicationEvents.$inferInsert> = [];

  // 1. Always SENT
  const sentTime = new Date(baseTime.getTime() + Math.random() * 3600000); // within 1hr of base
  events.push({
    campaignId,
    customerId,
    eventType: 'SENT',
    timestamp: sentTime,
    metadataJson: { channel, messageId: `msg-${crypto.randomUUID().slice(0, 8)}` },
  });

  // 2. Roll for delivery
  if (Math.random() > prob.delivered) {
    events.push({
      campaignId,
      customerId,
      eventType: 'FAILED',
      timestamp: new Date(sentTime.getTime() + 1200),
      metadataJson: { channel, failureReason: 'Carrier dispatch rejection' },
    });
    return events;
  }

  const deliveredTime = new Date(sentTime.getTime() + 2500);
  events.push({
    campaignId,
    customerId,
    eventType: 'DELIVERED',
    timestamp: deliveredTime,
    metadataJson: { channel, messageId: `msg-${crypto.randomUUID().slice(0, 8)}` },
  });

  // 3. Roll for read
  if (Math.random() > prob.read) return events;
  const readTime = new Date(deliveredTime.getTime() + 15000 + Math.random() * 3600000);
  events.push({
    campaignId,
    customerId,
    eventType: channel === 'EMAIL' ? 'OPENED' : 'READ',
    timestamp: readTime,
    metadataJson: { channel },
  });

  // 4. Roll for click
  if (Math.random() > prob.clicked) return events;
  const clickedTime = new Date(readTime.getTime() + 45000 + Math.random() * 600000);
  events.push({
    campaignId,
    customerId,
    eventType: 'CLICKED',
    timestamp: clickedTime,
    metadataJson: { channel, linkTarget: 'https://xeno-crm.in/promo' },
  });

  return events;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  CRM Analytics Seed Script — Starting');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ─── Step 1: Fetch existing segments ───────────────────────────
  const existingSegments = await db.select().from(schema.segments).limit(20);
  if (existingSegments.length === 0) {
    console.error('❌  No segments found in DB. Run npm run seed first to populate customers and segments.');
    process.exit(1);
  }
  console.log(`✓  Found ${existingSegments.length} existing segments.`);

  // Use first 3 segments for campaigns (or fewer if less exist)
  const segA = existingSegments[0];
  const segB = existingSegments[Math.min(1, existingSegments.length - 1)];
  const segC = existingSegments[Math.min(2, existingSegments.length - 1)];

  // ─── Step 2: Fetch 500 customer IDs for audience samples ───────
  const allCustomers = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .limit(1500);

  if (allCustomers.length === 0) {
    console.error('❌  No customers found. Run npm run seed first.');
    process.exit(1);
  }
  console.log(`✓  Found ${allCustomers.length} existing customers for audience sampling.`);

  const customerIds = allCustomers.map(c => c.id);

  // ─── Step 3: Clean ONLY analytics tables (preserve customers/orders) ───
  console.log('🧹  Cleaning analytics tables (preserving customers & orders)...');
  await db.delete(schema.communicationEvents);
  await db.delete(schema.communicationJobs);
  await db.delete(schema.campaignAudience);
  await db.delete(schema.campaigns);
  console.log('✓  Analytics tables cleaned.');

  // ─── Step 4: Define 3 campaigns ────────────────────────────────
  const now = new Date();
  const months = (n: number) => new Date(now.getTime() - n * 30 * 24 * 60 * 60 * 1000);

  const campaignDefs = [
    {
      name: 'Mumbai Monsoon Offer — WhatsApp',
      channel: 'WHATSAPP' as const,
      messageTemplate: 'Hi {{name}}! ☔ Beat the monsoon with our exclusive 30% off offer this week only. Shop now: https://xeno-crm.in/monsoon',
      segmentId: segA.id,
      launchTime: months(5),
      audienceCount: Math.min(500, customerIds.length),
      audienceOffset: 0,
    },
    {
      name: 'Festive Season Email Blast',
      channel: 'EMAIL' as const,
      messageTemplate: 'Dear {{name}}, 🎉 Diwali is here! Enjoy up to 50% off across Fashion, Beauty & Lifestyle. Limited time. Shop at: https://xeno-crm.in/diwali',
      segmentId: segB.id,
      launchTime: months(3),
      audienceCount: Math.min(400, customerIds.length),
      audienceOffset: 100,
    },
    {
      name: 'Win-Back SMS — Lapsed Customers',
      channel: 'SMS' as const,
      messageTemplate: 'We miss you {{name}}! 💛 It has been a while. Here is 20% off your next order. Use code: XENO20 at https://xeno-crm.in/winback',
      segmentId: segC.id,
      launchTime: months(1),
      audienceCount: Math.min(300, customerIds.length),
      audienceOffset: 200,
    },
  ];

  // ─── Step 5: Create campaigns and simulate events ───────────────
  for (const def of campaignDefs) {
    console.log(`\n📢  Creating campaign: "${def.name}" [${def.channel}]`);

    // a. Insert campaign record
    const [campaign] = await db
      .insert(schema.campaigns)
      .values({
        segmentId: def.segmentId,
        name: def.name,
        channel: def.channel,
        messageTemplate: def.messageTemplate,
        status: 'COMPLETED',
        audienceSize: def.audienceCount,
        createdAt: def.launchTime,
      })
      .returning();

    console.log(`   ↳ Campaign created: ${campaign.id}`);

    // b. Pick audience slice
    const audience = customerIds.slice(def.audienceOffset, def.audienceOffset + def.audienceCount);

    // c. Insert campaign_audience records
    const audienceRows = audience.map(cid => ({
      campaignId: campaign.id,
      customerId: cid,
    }));
    for (let i = 0; i < audienceRows.length; i += 500) {
      await db.insert(schema.campaignAudience).values(audienceRows.slice(i, i + 500));
    }
    console.log(`   ↳ Audience snapshot: ${audience.length} customers`);

    // d. Simulate communication events for each audience member
    let allEvents: Array<typeof schema.communicationEvents.$inferInsert> = [];
    let jobRows: Array<typeof schema.communicationJobs.$inferInsert> = [];

    for (const customerId of audience) {
      const events = simulateEvents(campaign.id, customerId, def.channel, def.launchTime);
      allEvents.push(...events);

      // Determine job status from last event
      const lastEvent = events[events.length - 1];
      const jobStatus = lastEvent.eventType === 'FAILED' ? 'FAILED' : 'SUCCESS';
      jobRows.push({
        campaignId: campaign.id,
        customerId,
        status: jobStatus,
        createdAt: def.launchTime,
        updatedAt: new Date(def.launchTime.getTime() + 120000),
      });
    }

    // e. Batch insert communication jobs
    for (let i = 0; i < jobRows.length; i += 500) {
      await db.insert(schema.communicationJobs).values(jobRows.slice(i, i + 500));
    }
    console.log(`   ↳ Communication jobs inserted: ${jobRows.length}`);

    // f. Batch insert communication events
    for (let i = 0; i < allEvents.length; i += 500) {
      await db.insert(schema.communicationEvents).values(allEvents.slice(i, i + 500));
    }
    console.log(`   ↳ Communication events inserted: ${allEvents.length}`);

    // g. Simulate revenue orders for clicked customers (20% conversion)
    const clickedEvents = allEvents.filter(e => e.eventType === 'CLICKED');
    let conversionCount = 0;
    const conversionOrders: Array<typeof schema.orders.$inferInsert> = [];

    for (const click of clickedEvents) {
      if (Math.random() < 0.20) {
        const amount = (Math.random() * 8000 + 500).toFixed(2);
        const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        conversionOrders.push({
          customerId: click.customerId,
          amount,
          category,
          orderDate: new Date((click.timestamp as Date).getTime() + 5000),
        });
        conversionCount++;
      }
    }

    if (conversionOrders.length > 0) {
      for (let i = 0; i < conversionOrders.length; i += 500) {
        await db.insert(schema.orders).values(conversionOrders.slice(i, i + 500));
      }
    }
    console.log(`   ↳ Conversion orders: ${conversionCount} (from ${clickedEvents.length} clicks)`);
  }

  // ─── Step 6: Verification summary ──────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Final Table Counts');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const evtCount = await pool.query('SELECT COUNT(*)::int as count FROM communication_events');
  const jobCount = await pool.query('SELECT COUNT(*)::int as count FROM communication_jobs');
  const campCount = await pool.query('SELECT COUNT(*)::int as count FROM campaigns');
  const custCount = await pool.query('SELECT COUNT(*)::int as count FROM customers');
  const ordCount = await pool.query('SELECT COUNT(*)::int as count FROM orders');

  console.log(`✓  Campaigns:            ${campCount.rows[0].count}`);
  console.log(`✓  Communication Jobs:   ${jobCount.rows[0].count}`);
  console.log(`✓  Communication Events: ${evtCount.rows[0].count}`);
  console.log(`✓  Customers (preserved): ${custCount.rows[0].count}`);
  console.log(`✓  Orders (with conversions): ${ordCount.rows[0].count}`);

  const eventBreakdown = await pool.query(`
    SELECT event_type, COUNT(*)::int as count
    FROM communication_events
    GROUP BY event_type
    ORDER BY count DESC
  `);
  console.log('\n  Event Breakdown:');
  for (const row of eventBreakdown.rows) {
    console.log(`   · ${row.event_type.padEnd(10)} → ${row.count}`);
  }

  console.log('\n✅  Seeding complete! Analytics data is now available.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await pool.end();
}

main().catch(err => {
  console.error('❌  Seeding failed:', err);
  process.exit(1);
});
