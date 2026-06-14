import { pool, db } from '../db/index';
import { SegmentRule, CustomerPreview, SegmentPreviewStats } from '../types/segment';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';


/**
 * Recursively compiles an AST SegmentRule into a PostgreSQL WHERE clause.
 * Populates the parameters array dynamically to ensure SQL injection protection.
 * 
 * @param rule The current node of the rules tree
 * @param params Accumulator array for parameterized query values
 * @returns Parameterized SQL string segment
 */
export function compileRuleToSql(rule: SegmentRule, params: any[]): string {
  if (rule.type === 'condition') {
    const { field, operator, value } = rule;
    const placeholder = `$${params.length + 1}`;
    
    let sqlField = '';
    if (field === 'totalSpend') {
      sqlField = 'total_spend';
    } else if (field === 'totalOrders') {
      sqlField = 'total_orders';
    } else if (field === 'city') {
      sqlField = 'city';
    } else if (field === 'categoryPurchased') {
      sqlField = 'categories_purchased';
    } else if (field === 'daysSinceLastPurchase') {
      // Coalesce NULL last purchases to a huge number (e.g. 999999 days)
      // to capture inactive / never-purchased users in filters like > 60 days
      sqlField = 'COALESCE(days_since_last_purchase, 999999)';
    } else {
      throw new Error(`Unsupported field name: ${field}`);
    }

    // Map operators
    if (operator === 'contains') {
      params.push(`%${value}%`);
      return `${sqlField} ILIKE ${placeholder}`;
    } else {
      // For arithmetic operators (=, !=, <, >)
      const numericVal = typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : value;
      params.push(numericVal);
      return `${sqlField} ${operator} ${placeholder}`;
    }
  } else if (rule.type === 'group') {
    if (!rule.children || rule.children.length === 0) {
      return 'TRUE';
    }
    const compiledChildren = rule.children.map(child => compileRuleToSql(child, params));
    return `(${compiledChildren.join(` ${rule.logic} `)})`;
  }
  throw new Error(`Unsupported rule node type`);
}

/**
 * Returns the base Common Table Expression (CTE) query string.
 * This pre-aggregates customer metrics and orders to create the virtual schema.
 */
export function getBaseCteString(): string {
  return `
    WITH customer_metrics AS (
      SELECT 
        c.id AS id,
        c.first_name AS "firstName",
        c.last_name AS "lastName",
        c.email AS email,
        c.phone AS phone,
        c.city AS city,
        COALESCE(SUM(o.amount), 0) AS total_spend,
        COUNT(o.id) AS total_orders,
        ARRAY_TO_STRING(ARRAY_AGG(DISTINCT o.category) FILTER (WHERE o.category IS NOT NULL), ',') AS categories_purchased,
        EXTRACT(DAY FROM (NOW() - MAX(o.order_date)))::integer AS days_since_last_purchase
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      GROUP BY c.id, c.first_name, c.last_name, c.email, c.phone, c.city
    )
  `;
}

/**
 * Evaluates the rules and executes a COUNT query on the database.
 */
export async function getAudienceCount(rule: SegmentRule): Promise<number> {
  const params: any[] = [];
  const whereClause = compileRuleToSql(rule, params);
  const cte = getBaseCteString();
  const query = `${cte} SELECT COUNT(1)::integer as count FROM customer_metrics WHERE ${whereClause};`;

  try {
    const result = await pool.query(query, params);
    if (result && result.rows.length > 0) {
      return result.rows[0].count;
    }
    return 0;
  } catch (error) {
    console.error('Failed to calculate audience count:', error);
    throw error;
  }
}

/**
 * Returns a subset of audience records for UI preview.
 */
export async function getAudiencePreview(rule: SegmentRule, limit = 10): Promise<CustomerPreview[]> {
  const params: any[] = [];
  const whereClause = compileRuleToSql(rule, params);
  const cte = getBaseCteString();
  const query = `${cte} SELECT id, "firstName", "lastName", email, phone, city FROM customer_metrics WHERE ${whereClause} LIMIT ${limit};`;

  try {
    const result = await pool.query(query, params);
    return result.rows as CustomerPreview[];
  } catch (error) {
    console.error('Failed to fetch audience preview:', error);
    throw error;
  }
}

/**
 * Computes live segment preview stats against customer dataset.
 */
export async function getSegmentPreviewStats(rule: SegmentRule): Promise<SegmentPreviewStats> {
  const params: any[] = [];
  const whereClause = compileRuleToSql(rule, params);
  const cte = getBaseCteString();

  const statsQuery = `
    ${cte},
    matched_customers AS (
      SELECT * FROM customer_metrics WHERE ${whereClause}
    )
    SELECT
      COUNT(*)::integer AS matched_audience,
      COALESCE(SUM(total_spend), 0)::float AS potential_revenue,
      COALESCE(SUM(total_spend) / NULLIF(SUM(total_orders), 0), 0)::float AS average_order_value,
      COALESCE(AVG(total_orders), 0)::float AS average_orders_count
    FROM matched_customers;
  `;

  const cityQuery = `
    ${cte},
    matched_customers AS (
      SELECT * FROM customer_metrics WHERE ${whereClause}
    )
    SELECT
      city,
      COUNT(*)::integer AS count
    FROM matched_customers
    GROUP BY city
    ORDER BY count DESC, city ASC;
  `;

  try {
    const statsRes = await pool.query(statsQuery, params);
    const matchedAudience = statsRes.rows[0]?.matched_audience || 0;
    const potentialRevenue = statsRes.rows[0]?.potential_revenue || 0;
    const averageOrderValue = statsRes.rows[0]?.average_order_value || 0;
    const averageOrdersCount = statsRes.rows[0]?.average_orders_count || 0;

    const cityRes = await pool.query(cityQuery, params);
    const cities = cityRes.rows;

    const topPerformingCity = cities[0]?.city || '—';

    const cityDistribution = cities.slice(0, 5).map(row => ({
      city: row.city,
      count: row.count,
      percentage: matchedAudience > 0 ? Number(((row.count / matchedAudience) * 100).toFixed(1)) : 0
    }));

    return {
      matchedAudience,
      averageOrderValue,
      potentialRevenue,
      topPerformingCity,
      averageOrdersCount,
      cityDistribution
    };
  } catch (error) {
    console.error('Failed to compute segment preview stats:', error);
    return {
      matchedAudience: 0,
      averageOrderValue: 0,
      potentialRevenue: 0,
      topPerformingCity: '—',
      averageOrdersCount: 0,
      cityDistribution: []
    };
  }
}

/**
 * Returns the full list of matching customer IDs in the segment.
 */
export async function getAudienceIds(rule: SegmentRule): Promise<string[]> {
  const params: any[] = [];
  const whereClause = compileRuleToSql(rule, params);
  const cte = getBaseCteString();
  const query = `${cte} SELECT id FROM customer_metrics WHERE ${whereClause};`;

  try {
    const result = await pool.query(query, params);
    return result.rows.map((row: any) => row.id as string);
  } catch (error) {
    console.error('Failed to query audience IDs:', error);
    throw error;
  }
}

/**
 * Creates a segment in the database.
 */
export async function createSegmentRecord(name: string, description: string | undefined, rulesJson: SegmentRule) {
  const res = await db.insert(schema.segments).values({
    name,
    description: description || null,
    rulesJson
  }).returning();
  return res[0];
}

/**
 * Retrieves a single segment by ID.
 */
export async function getSegmentRecord(id: string) {
  const res = await db.select().from(schema.segments).where(eq(schema.segments.id, id)).limit(1);
  return res[0] || null;
}

/**
 * Lists all segments.
 */
export async function listSegmentsRecords() {
  return db.select().from(schema.segments).orderBy(schema.segments.createdAt);
}

