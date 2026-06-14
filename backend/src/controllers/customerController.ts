import { Request, Response, NextFunction } from 'express';
import { pool, db } from '../db/index';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

// Create Customer
export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, phone, city, totalSpend, totalOrders, lastPurchaseDate } = req.body;
    
    // Validate missing fields
    if (!name || !email || !phone || !city) {
      return res.status(400).json({ success: false, message: 'Missing required field' });
    }
    if (typeof name !== 'string' || !name.trim() ||
        typeof email !== 'string' || !email.trim() ||
        typeof phone !== 'string' || !phone.trim() ||
        typeof city !== 'string' || !city.trim()) {
      return res.status(400).json({ success: false, message: 'Missing required field' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    // Validate phone number format (must be 10 digits as required)
    const phoneTrimmed = phone.trim();
    if (!/^[0-9]{10}$/.test(phoneTrimmed)) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    // Validate metrics formatting
    if (totalSpend !== undefined && (isNaN(Number(totalSpend)) || Number(totalSpend) < 0)) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }
    if (totalOrders !== undefined && (isNaN(Number(totalOrders)) || Number(totalOrders) < 0)) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    // 1. Insert customer
    const insertedCustomers = await db.insert(schema.customers).values({
      firstName,
      lastName,
      email: email.trim(),
      phone: phoneTrimmed,
      city: city.trim(),
      createdAt: new Date()
    }).returning();
    const customer = insertedCustomers[0];

    // 2. Insert orders if totalOrders > 0 and totalSpend > 0
    const ordersCount = Number(totalOrders) || 0;
    const spend = Number(totalSpend) || 0;
    if (ordersCount > 0 && spend > 0) {
      const amountPerOrder = spend / ordersCount;
      const orderDate = lastPurchaseDate ? new Date(lastPurchaseDate) : new Date();

      for (let i = 0; i < ordersCount; i++) {
        await db.insert(schema.orders).values({
          customerId: customer.id,
          amount: amountPerOrder.toFixed(2),
          category: 'Other',
          orderDate
        });
      }
    }

    // 3. Return full details with metrics
    res.status(201).json({
      ...customer,
      totalSpend: spend,
      totalOrders: ordersCount,
      lastPurchaseDate: lastPurchaseDate || new Date().toISOString()
    });
  } catch (error: any) {
    next(error);
  }
}

// List Customers with metrics
export async function listCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = `
      SELECT 
        c.id,
        c.first_name AS "firstName",
        c.last_name AS "lastName",
        c.email,
        c.phone,
        c.city,
        c.created_at AS "createdAt",
        COALESCE(SUM(o.amount), 0)::float AS "totalSpend",
        COUNT(o.id)::integer AS "totalOrders",
        MAX(o.order_date) AS "lastPurchaseDate"
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone, c.city, c.created_at
      ORDER BY c.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

// Get Single Customer with metrics
export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        c.id,
        c.first_name AS "firstName",
        c.last_name AS "lastName",
        c.email,
        c.phone,
        c.city,
        c.created_at AS "createdAt",
        COALESCE(SUM(o.amount), 0)::float AS "totalSpend",
        COUNT(o.id)::integer AS "totalOrders",
        MAX(o.order_date) AS "lastPurchaseDate"
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      WHERE c.id = $1
      GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone, c.city, c.created_at;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Customer with ID ${id} not found.` });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

// Update Customer
export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, email, phone, city, totalSpend, totalOrders, lastPurchaseDate } = req.body;

    // Validate if fields are sent
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ success: false, message: 'Missing required field' });
    }
    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Missing required field' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ success: false, message: 'Invalid data' });
      }
    }
    if (phone !== undefined) {
      if (typeof phone !== 'string' || !phone.trim()) {
        return res.status(400).json({ success: false, message: 'Missing required field' });
      }
      if (!/^[0-9]{10}$/.test(phone.trim())) {
        return res.status(400).json({ success: false, message: 'Invalid data' });
      }
    }
    if (city !== undefined && (typeof city !== 'string' || !city.trim())) {
      return res.status(400).json({ success: false, message: 'Missing required field' });
    }
    if (totalSpend !== undefined && (isNaN(Number(totalSpend)) || Number(totalSpend) < 0)) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }
    if (totalOrders !== undefined && (isNaN(Number(totalOrders)) || Number(totalOrders) < 0)) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    const nameParts = name ? name.trim().split(/\s+/) : [];
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    // 1. Update customer row
    const updateValues: any = {};
    if (firstName !== undefined) updateValues.firstName = firstName;
    if (lastName !== undefined) updateValues.lastName = lastName;
    if (email !== undefined) updateValues.email = email.trim();
    if (phone !== undefined) updateValues.phone = phone.trim();
    if (city !== undefined) updateValues.city = city.trim();

    const updated = await db.update(schema.customers)
      .set(updateValues)
      .where(eq(schema.customers.id, id))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ success: false, message: `Customer with ID ${id} not found.` });
    }

    const customer = updated[0];

    // 2. Update orders if totalOrders / totalSpend are provided
    if (totalOrders !== undefined || totalSpend !== undefined) {
      const ordersCount = Number(totalOrders) || 0;
      const spend = Number(totalSpend) || 0;

      // Delete existing orders
      await pool.query('DELETE FROM orders WHERE customer_id = $1', [id]);

      // Re-insert orders
      if (ordersCount > 0 && spend > 0) {
        const amountPerOrder = spend / ordersCount;
        const orderDate = lastPurchaseDate ? new Date(lastPurchaseDate) : new Date();

        for (let i = 0; i < ordersCount; i++) {
          await db.insert(schema.orders).values({
            customerId: id,
            amount: amountPerOrder.toFixed(2),
            category: 'Other',
            orderDate
          });
        }
      }
    }

    // Return the updated customer with calculated/updated details
    const finalResult = await pool.query(`
      SELECT 
        c.id,
        c.first_name AS "firstName",
        c.last_name AS "lastName",
        c.email,
        c.phone,
        c.city,
        c.created_at AS "createdAt",
        COALESCE(SUM(o.amount), 0)::float AS "totalSpend",
        COUNT(o.id)::integer AS "totalOrders",
        MAX(o.order_date) AS "lastPurchaseDate"
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      WHERE c.id = $1
      GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone, c.city, c.created_at;
    `, [id]);

    res.json(finalResult.rows[0]);
  } catch (error: any) {
    next(error);
  }
}

// Delete Customer
export async function deleteCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const deleted = await db.delete(schema.customers).where(eq(schema.customers.id, id)).returning();
    if (deleted.length === 0) {
      return res.status(404).json({ success: false, message: `Customer with ID ${id} not found.` });
    }
    res.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (error) {
    next(error);
  }
}
