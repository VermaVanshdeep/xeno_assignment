import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

// Create Order
export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { customerId, amount, category, orderDate } = req.body;

    if (!customerId || !amount || !category) {
      return res.status(400).json({ success: false, message: 'Missing required field' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    if (typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Missing required field' });
    }

    // Validate customer exists
    const customer = await db.select().from(schema.customers).where(eq(schema.customers.id, customerId)).limit(1);
    if (customer.length === 0) {
      return res.status(400).json({ success: false, message: 'Related record not found' });
    }

    console.log(`[audit]: Order creation request initiated for customerId: ${customerId}`);

    // Insert order
    const insertedOrders = await db.insert(schema.orders).values({
      customerId,
      amount: numAmount.toFixed(2),
      category: category.trim(),
      orderDate: orderDate ? new Date(orderDate) : new Date()
    }).returning();

    const order = insertedOrders[0];
    console.log(`[audit]: Order created successfully: ID: ${order.id}, Customer: ${customerId}, Amount: ₹${numAmount}`);

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
}

// Get Order
export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const order = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
    if (order.length === 0) {
      return res.status(404).json({ success: false, message: `Order with ID ${id} not found.` });
    }
    res.json(order[0]);
  } catch (error) {
    next(error);
  }
}

// Delete Order
export async function deleteOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    console.log(`[audit]: Deletion request received for order ID: ${id}`);
    const deleted = await db.delete(schema.orders).where(eq(schema.orders.id, id)).returning();
    if (deleted.length === 0) {
      return res.status(404).json({ success: false, message: `Order with ID ${id} not found.` });
    }
    console.log(`[audit]: Order ${id} deleted successfully`);
    res.json({ success: true, message: 'Order deleted successfully.' });
  } catch (error) {
    next(error);
  }
}
