import { db } from './backend/src/db';
import { customers, orders } from './backend/src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  try {
    const custs = await db.select().from(customers).where(eq(customers.email, 'test.vanshdeep@example.com'));
    if (custs.length > 0) {
      await db.delete(orders).where(eq(orders.customerId, custs[0].id));
      await db.delete(customers).where(eq(customers.email, 'test.vanshdeep@example.com'));
      console.log('Deleted');
    } else {
      console.log('Not found');
    }
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
main();
