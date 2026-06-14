import { db } from './db/index';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('=== VERIFYING PROPAGATED DATA IN POSTGRESQL ===');
    
    // 1. Customer row
    const customerQuery = await db.execute(sql`
      SELECT id, first_name AS "firstName", last_name AS "lastName", email, phone, city, created_at AS "createdAt"
      FROM customers 
      WHERE email = 'vanshdeep.verma@example.com';
    `);
    console.log('\n--- Customer Record ---');
    console.log(JSON.stringify(customerQuery.rows, null, 2));

    if (customerQuery.rows.length > 0) {
      const customerId = customerQuery.rows[0].id;
      
      // 2. Order row
      const orderQuery = await db.execute(sql`
        SELECT id, customer_id AS "customerId", amount, order_date AS "orderDate", category 
        FROM orders 
        WHERE customer_id = ${customerId};
      `);
      console.log('\n--- Order Record ---');
      console.log(JSON.stringify(orderQuery.rows, null, 2));
    } else {
      console.log('\n❌ Customer record not found for email vanshdeep.verma@example.com');
    }

    // 3. Overall database counts
    console.log('\n--- Database Summary Totals ---');
    const custCount = await db.execute(sql`SELECT COUNT(*) FROM customers;`);
    const ordCount = await db.execute(sql`SELECT COUNT(*) FROM orders;`);
    const sumAmount = await db.execute(sql`SELECT SUM(amount) FROM orders;`);
    
    console.log('Customers Count:', custCount.rows[0].count);
    console.log('Orders Count:', ordCount.rows[0].count);
    console.log('Total Revenue Sum (Attributed):', sumAmount.rows[0].sum);

  } catch (err) {
    console.error('Error in verification:', err);
  }
  process.exit(0);
}

main();
