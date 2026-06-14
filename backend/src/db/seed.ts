import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { fakerEN_IN as faker } from '@faker-js/faker';
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

// Connection details
const connectionString = getSafeConnectionString(process.env.DATABASE_URL);
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const db = drizzle(pool, { schema });

// Const lists
const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata', 'Ahmedabad'];
const CATEGORIES = ['Fashion', 'Beauty', 'Coffee', 'Lifestyle', 'Electronics'];

async function main() {
  console.log('--- Starting CRM Seeding Script ---');

  // 1. Clear existing database rows (cascading deletes will trigger)
  console.log('Cleaning existing database data...');
  await db.delete(schema.communicationEvents);
  await db.delete(schema.campaignAudience);
  await db.delete(schema.campaigns);
  await db.delete(schema.segments);
  await db.delete(schema.orders);
  await db.delete(schema.customers);
  console.log('Database cleaned successfully.');

  // 2. Generate 10,000 Customers
  console.log('Generating 10,000 customers...');
  const customerRows: Array<typeof schema.customers.$inferInsert> = [];
  
  // Cohorts: 70% low (7000), 20% medium (2000), 10% high (1000)
  const lowSpenderIds: string[] = [];
  const medSpenderIds: string[] = [];
  const highSpenderIds: string[] = [];

  for (let i = 0; i < 10000; i++) {
    const id = crypto.randomUUID();
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    // Unique email creation
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}@xeno-crm.in`;
    // Indian phone numbers: +91 followed by 10 digits
    const phone = `+91${faker.helpers.arrayElement(['9', '8', '7', '6'])}${faker.string.numeric(9)}`;
    const city = faker.helpers.arrayElement(CITIES);
    const createdAt = faker.date.between({
      from: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // last 180 days
      to: new Date()
    });

    customerRows.push({
      id,
      firstName,
      lastName,
      email,
      phone,
      city,
      createdAt
    });

    // Segment into spender cohort arrays
    if (i < 7000) {
      lowSpenderIds.push(id);
    } else if (i < 9000) {
      medSpenderIds.push(id);
    } else {
      highSpenderIds.push(id);
    }
  }

  // Bulk Insert Customers in chunks of 1,000
  console.log('Inserting customers into PostgreSQL...');
  for (let chunkIdx = 0; chunkIdx < customerRows.length; chunkIdx += 1000) {
    const chunk = customerRows.slice(chunkIdx, chunkIdx + 1000);
    await db.insert(schema.customers).values(chunk);
    console.log(`Inserted customers ${chunkIdx + chunk.length} / 10000`);
  }

  // 3. Generate 50,000 Orders according to spender distributions
  console.log('Generating 50,000 orders with spender distribution...');
  const orderRows: Array<typeof schema.orders.$inferInsert> = [];

  // Low Spenders: 70% cohort, receives 25,000 orders (average ₹100 - ₹1,500 per order)
  console.log('Generating low spender orders...');
  for (let i = 0; i < 25000; i++) {
    const customerId = faker.helpers.arrayElement(lowSpenderIds);
    const amount = faker.number.float({ min: 100, max: 1500, fractionDigits: 2 }).toString();
    const category = faker.helpers.arrayElement(CATEGORIES);
    const orderDate = faker.date.between({
      from: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000), // last 150 days
      to: new Date()
    });

    orderRows.push({
      customerId,
      amount,
      category,
      orderDate
    });
  }

  // Medium Spenders: 20% cohort, receives 15,000 orders (average ₹1,500 - ₹5,000 per order)
  console.log('Generating medium spender orders...');
  for (let i = 0; i < 15000; i++) {
    const customerId = faker.helpers.arrayElement(medSpenderIds);
    const amount = faker.number.float({ min: 1500, max: 5000, fractionDigits: 2 }).toString();
    const category = faker.helpers.arrayElement(CATEGORIES);
    const orderDate = faker.date.between({
      from: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000),
      to: new Date()
    });

    orderRows.push({
      customerId,
      amount,
      category,
      orderDate
    });
  }

  // High Spenders: 10% cohort, receives 10,000 orders (average ₹6,000 - ₹50,000 per order)
  console.log('Generating high spender orders...');
  for (let i = 0; i < 10000; i++) {
    const customerId = faker.helpers.arrayElement(highSpenderIds);
    const amount = faker.number.float({ min: 6000, max: 50000, fractionDigits: 2 }).toString();
    const category = faker.helpers.arrayElement(CATEGORIES);
    const orderDate = faker.date.between({
      from: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000),
      to: new Date()
    });

    orderRows.push({
      customerId,
      amount,
      category,
      orderDate
    });
  }

  // Bulk Insert Orders in chunks of 1,000
  console.log('Inserting orders into PostgreSQL...');
  for (let chunkIdx = 0; chunkIdx < orderRows.length; chunkIdx += 1000) {
    const chunk = orderRows.slice(chunkIdx, chunkIdx + 1000);
    await db.insert(schema.orders).values(chunk);
    console.log(`Inserted orders ${chunkIdx + chunk.length} / 50000`);
  }

  console.log('--- Seeding Completed Successfully ---');
  await pool.end();
}

main().catch((err) => {
  console.error('Seeding process encountered an error:', err);
  process.exit(1);
});
