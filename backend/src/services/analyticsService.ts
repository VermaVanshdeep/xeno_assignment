import { pool } from '../db/index';
import { 
  CampaignAnalytics, 
  CampaignSummary, 
  CustomerAnalyticsSummary, 
  ChannelPerformance, 
  DashboardMetrics,
  RevenueTrend,
  CRMHealth
} from '../types/analytics';

// Channel messaging costs (INR)
const CHANNEL_COSTS = {
  WHATSAPP: 0.50,
  SMS: 0.15,
  EMAIL: 0.05,
  RCS: 0.25
};

/**
 * Calculates campaign revenue attributed within 7 days of delivery receipt.
 */
export async function getCampaignRevenue(campaignId: string): Promise<number> {
  // Primary: full attribution via campaign_audience snapshot + 7-day post-delivery window
  const query = `
    SELECT COALESCE(SUM(attributed.amount), 0)::float AS revenue
    FROM (
      SELECT DISTINCT ON (o.id) o.id, o.amount
      FROM orders o
      JOIN communication_events e ON o.customer_id = e.customer_id
      JOIN campaign_audience a 
        ON a.campaign_id = e.campaign_id 
        AND a.customer_id = e.customer_id
      WHERE e.campaign_id = $1
        AND e.event_type = 'DELIVERED'
        AND o.order_date >= e.timestamp
        AND o.order_date <= e.timestamp + INTERVAL '7 days'
    ) attributed;
  `;

  try {
    const res = await pool.query(query, [campaignId]);
    const primary = res.rows[0]?.revenue || 0;

    if (primary > 0) return primary;

    // Fallback: skip campaign_audience join (handles campaigns without audience snapshot)
    const fallback = `
      SELECT COALESCE(SUM(attributed.amount), 0)::float AS revenue
      FROM (
        SELECT DISTINCT ON (o.id) o.id, o.amount
        FROM orders o
        JOIN communication_events e ON o.customer_id = e.customer_id
        WHERE e.campaign_id = $1
          AND e.event_type = 'DELIVERED'
          AND o.order_date >= e.timestamp
          AND o.order_date <= e.timestamp + INTERVAL '7 days'
      ) attributed;
    `;
    const fallbackRes = await pool.query(fallback, [campaignId]);
    return fallbackRes.rows[0]?.revenue || 0;
  } catch (error) {
    console.error(`Failed to calculate campaign revenue for ${campaignId}:`, error);
    return 0;
  }
}

/**
 * Calculates Campaign ROI based on message channel rates.
 */
export async function getCampaignROI(campaignId: string): Promise<number> {
  const campaignQuery = `
    SELECT channel
    FROM campaigns
    WHERE id = $1
    LIMIT 1;
  `;
  const campaignRes = await pool.query(campaignQuery, [campaignId]);
  if (campaignRes.rows.length === 0) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  const { channel } = campaignRes.rows[0];

  const sentQuery = `
    SELECT COUNT(1)::integer AS sent
    FROM communication_events
    WHERE campaign_id = $1 AND event_type = 'SENT';
  `;
  const sentRes = await pool.query(sentQuery, [campaignId]);
  const sent = sentRes.rows[0]?.sent || 0;

  const revenue = await getCampaignRevenue(campaignId);
  const unitCost = CHANNEL_COSTS[channel.toUpperCase() as keyof typeof CHANNEL_COSTS] || 0.15;
  const cost = sent * unitCost;

  return cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
}

/**
 * Compiles campaign delivered, read, click counts, rates, and revenue attribution.
 */
export async function getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
  // 1. Fetch Campaign Details
  const campaignQuery = `
    SELECT channel, audience_size AS "audienceSize"
    FROM campaigns
    WHERE id = $1
    LIMIT 1;
  `;
  const campaignRes = await pool.query(campaignQuery, [campaignId]);
  if (campaignRes.rows.length === 0) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  const { channel, audienceSize } = campaignRes.rows[0];

  // 2. Fetch Event counts
  const eventQuery = `
    SELECT 
      COUNT(CASE WHEN event_type = 'SENT' THEN 1 END)::integer AS sent,
      COUNT(CASE WHEN event_type = 'DELIVERED' THEN 1 END)::integer AS delivered,
      COUNT(CASE WHEN event_type = 'FAILED' THEN 1 END)::integer AS failed,
      COUNT(CASE WHEN event_type = 'OPENED' THEN 1 END)::integer AS opened,
      COUNT(CASE WHEN event_type = 'READ' THEN 1 END)::integer AS read_count,
      COUNT(CASE WHEN event_type = 'CLICKED' THEN 1 END)::integer AS clicked
    FROM communication_events
    WHERE campaign_id = $1;
  `;
  const eventRes = await pool.query(eventQuery, [campaignId]);
  const row = eventRes.rows[0] || { sent: 0, delivered: 0, failed: 0, opened: 0, read_count: 0, clicked: 0 };

  const sent = row.sent || 0;
  const delivered = row.delivered || 0;
  const failed = row.failed || 0;
  const opened = row.opened || 0;
  const read = row.read_count || 0;
  const clicked = row.clicked || 0;

  // Calculate open counter depending on channel (Email uses OPENED, WhatsApp/SMS/RCS use READ)
  const isEmail = channel.toUpperCase() === 'EMAIL';
  const openCountForRates = isEmail ? opened : read;

  // 3. Compute conversion percentages safely
  const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
  const openRate = delivered > 0 ? (openCountForRates / delivered) * 100 : 0;
  const readRate = delivered > 0 ? (read / delivered) * 100 : 0;
  const ctr = delivered > 0 ? (clicked / delivered) * 100 : 0;

  // 4. Attribution calculations
  const campaignRevenue = await getCampaignRevenue(campaignId);
  const campaignRoi = await getCampaignROI(campaignId);
  const unitCost = CHANNEL_COSTS[channel.toUpperCase() as keyof typeof CHANNEL_COSTS] || 0.15;
  const campaignCost = sent * unitCost;

  return {
    campaignId,
    audienceSize,
    sent,
    delivered,
    failed,
    opened,
    read,
    clicked,
    deliveryRate,
    openRate,
    readRate,
    ctr,
    campaignRevenue,
    campaignCost,
    campaignRoi
  };
}


/**
 * Returns performance list summary for all campaigns.
 */
export async function getCampaignPerformanceSummary(): Promise<CampaignSummary[]> {
  const query = `
    SELECT 
      c.id, c.name, c.channel, c.status, c.audience_size AS "audienceSize", c.created_at AS "createdAt",
      COUNT(CASE WHEN e.event_type = 'SENT' THEN 1 END)::integer AS sent,
      COUNT(CASE WHEN e.event_type = 'DELIVERED' THEN 1 END)::integer AS delivered,
      COUNT(CASE WHEN e.event_type = 'OPENED' THEN 1 END)::integer AS opened,
      COUNT(CASE WHEN e.event_type = 'READ' THEN 1 END)::integer AS read_count,
      COUNT(CASE WHEN e.event_type = 'CLICKED' THEN 1 END)::integer AS clicked
    FROM campaigns c
    LEFT JOIN communication_events e ON c.id = e.campaign_id
    GROUP BY c.id, c.name, c.channel, c.status, c.audience_size, c.created_at
    ORDER BY c.created_at DESC;
  `;

  try {
    const res = await pool.query(query);
    const summaries: CampaignSummary[] = [];
    
    for (const row of res.rows) {
      const revenue = await getCampaignRevenue(row.id);
      summaries.push({
        id: row.id,
        name: row.name,
        channel: row.channel,
        status: row.status,
        audienceSize: row.audienceSize,
        createdAt: row.createdAt,
        sent: row.sent || 0,
        delivered: row.delivered || 0,
        opened: row.opened || 0,
        read: row.read_count || 0,
        clicked: row.clicked || 0,
        revenue
      });
    }

    return summaries;
  } catch (error) {
    console.error('Failed to fetch campaigns performance summary:', error);
    return [];
  }
}

/**
 * Returns overall customer counts and demographics.
 */
export async function getCustomerAnalytics(): Promise<CustomerAnalyticsSummary> {
  const countQuery = 'SELECT COUNT(1)::integer as total FROM customers;';
  const cityQuery = 'SELECT city, COUNT(id)::integer as count FROM customers GROUP BY city ORDER BY count DESC;';

  try {
    const countRes = await pool.query(countQuery);
    const cityRes = await pool.query(cityQuery);

    return {
      totalCustomers: countRes.rows[0]?.total || 0,
      cityDistribution: cityRes.rows.map(row => ({
        city: row.city,
        count: row.count
      }))
    };
  } catch (error) {
    console.error('Failed to query customer analytics:', error);
    return { totalCustomers: 0, cityDistribution: [] };
  }
}

/**
 * Groups and returns metrics aggregated per communication channel.
 */
export async function getChannelPerformance(): Promise<ChannelPerformance[]> {
  const query = `
    SELECT 
      c.channel AS channel,
      COUNT(CASE WHEN e.event_type = 'SENT' THEN 1 END)::integer AS sent,
      COUNT(CASE WHEN e.event_type = 'DELIVERED' THEN 1 END)::integer AS delivered,
      COUNT(CASE WHEN e.event_type = 'OPENED' THEN 1 END)::integer AS opened,
      COUNT(CASE WHEN e.event_type = 'READ' THEN 1 END)::integer AS read_count,
      COUNT(CASE WHEN e.event_type = 'CLICKED' THEN 1 END)::integer AS clicked
    FROM campaigns c
    JOIN communication_events e ON c.id = e.campaign_id
    GROUP BY c.channel;
  `;

  try {
    const res = await pool.query(query);
    return res.rows.map(row => {
      const sent = row.sent || 0;
      const delivered = row.delivered || 0;
      const opened = row.opened || 0;
      const read = row.read_count || 0;
      const clicked = row.clicked || 0;
      
      const isEmail = row.channel.toUpperCase() === 'EMAIL';
      const openCountForRates = isEmail ? opened : read;

      return {
        channel: row.channel,
        sent,
        delivered,
        opened,
        read,
        clicked,
        deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
        openRate: delivered > 0 ? (openCountForRates / delivered) * 100 : 0,
        readRate: delivered > 0 ? (read / delivered) * 100 : 0,
        ctr: delivered > 0 ? (clicked / delivered) * 100 : 0
      };
    });
  } catch (error) {
    console.error('Failed to query channel performance:', error);
    return [];
  }
}

/**
 * Computes dynamic CRM KPIs from orders database.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const query = `
    SELECT
      (SELECT COUNT(*)::integer FROM customers) AS total_customers,
      (SELECT COALESCE(SUM(amount), 0)::float FROM orders) AS total_revenue,
      (SELECT COUNT(*)::integer FROM orders) AS total_orders,
      (SELECT COUNT(*)::integer FROM campaigns) AS total_campaigns;
  `;

  try {
    const res = await pool.query(query);
    const row = res.rows[0];

    return {
      totalCustomers: row.total_customers || 0,
      totalRevenue: row.total_revenue || 0,
      totalOrders: row.total_orders || 0,
      totalCampaigns: row.total_campaigns || 0
    };
  } catch (error) {
    console.error('Failed to calculate dashboard metrics:', error);
    return {
      totalCustomers: 0,
      totalRevenue: 0,
      totalOrders: 0,
      totalCampaigns: 0
    };
  }
}

/**
 * Calculates monthly revenue trend from orders database.
 */
export async function getRevenueTrend(): Promise<RevenueTrend[]> {
  const query = `
    SELECT 
      TO_CHAR(order_date, 'Mon') AS month,
      DATE_TRUNC('month', order_date) AS month_date,
      COALESCE(SUM(amount), 0)::float AS revenue
    FROM orders
    GROUP BY TO_CHAR(order_date, 'Mon'), DATE_TRUNC('month', order_date)
    ORDER BY month_date ASC;
  `;

  try {
    const res = await pool.query(query);
    return res.rows.map(row => ({
      month: row.month,
      revenue: row.revenue
    }));
  } catch (error) {
    console.error('Failed to query revenue trend:', error);
    return [];
  }
}

/**
 * Returns CRM-level health scores and intelligence summary.
 * All values are derived from real database queries — no hardcoded metrics.
 */
export async function getCRMHealth(): Promise<CRMHealth> {
  try {
    // 1. Campaign health score: weighted avg delivery+ctr across completed campaigns
    const healthQuery = `
      SELECT 
        c.id, c.name, c.channel,
        COUNT(CASE WHEN e.event_type = 'SENT' THEN 1 END)::float AS sent,
        COUNT(CASE WHEN e.event_type = 'DELIVERED' THEN 1 END)::float AS delivered,
        COUNT(CASE WHEN e.event_type = 'CLICKED' THEN 1 END)::float AS clicked
      FROM campaigns c
      JOIN communication_events e ON c.id = e.campaign_id
      WHERE c.status IN ('COMPLETED', 'RUNNING')
      GROUP BY c.id, c.name, c.channel
      HAVING COUNT(CASE WHEN e.event_type = 'SENT' THEN 1 END) > 0;
    `;
    const healthRes = await pool.query(healthQuery);
    
    let totalHealthScore = 0;
    let healthCount = 0;
    for (const row of healthRes.rows) {
      const deliveryRate = row.sent > 0 ? (row.delivered / row.sent) * 100 : 0;
      const ctr = row.delivered > 0 ? (row.clicked / row.delivered) * 100 : 0;
      // Weighted: delivery 40%, ctr 60% (normalized to 100-point scale)
      // Delivery typically 95-100%, CTR typically 5-20%
      const campaignScore = Math.min(100, (deliveryRate * 0.4) + (Math.min(ctr * 5, 60)));
      totalHealthScore += campaignScore;
      healthCount++;
    }
    const campaignHealthScore = healthCount > 0 ? Math.round(totalHealthScore / healthCount) : 0;

    // 2. Audience quality: % of customers who have placed at least 1 order
    const qualityQuery = `
      SELECT 
        COUNT(DISTINCT c.id)::float AS total_customers,
        COUNT(DISTINCT o.customer_id)::float AS customers_with_orders
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id;
    `;
    const qualityRes = await pool.query(qualityQuery);
    const { total_customers, customers_with_orders } = qualityRes.rows[0] || { total_customers: 0, customers_with_orders: 0 };
    const audienceQualityScore = total_customers > 0 
      ? Math.round((customers_with_orders / total_customers) * 100)
      : 0;

    // 3. Top converting city: city with most clicked events relative to delivered
    const cityQuery = `
      SELECT 
        cust.city,
        COUNT(CASE WHEN e.event_type = 'CLICKED' THEN 1 END)::float AS clicked,
        COUNT(CASE WHEN e.event_type = 'DELIVERED' THEN 1 END)::float AS delivered
      FROM communication_events e
      JOIN customers cust ON e.customer_id = cust.id
      GROUP BY cust.city
      HAVING COUNT(CASE WHEN e.event_type = 'DELIVERED' THEN 1 END) > 10
      ORDER BY (COUNT(CASE WHEN e.event_type = 'CLICKED' THEN 1 END)::float / 
                NULLIF(COUNT(CASE WHEN e.event_type = 'DELIVERED' THEN 1 END)::float, 0)) DESC
      LIMIT 1;
    `;
    const cityRes = await pool.query(cityQuery);
    const topConvertingCity = cityRes.rows[0]?.city || 'N/A';

    // 4. Revenue attribution: total attributed vs total orders revenue
    const revenueQuery = `
      SELECT COALESCE(SUM(amount), 0)::float AS total_revenue FROM orders;
    `;
    const revenueRes = await pool.query(revenueQuery);
    const totalRevenue = revenueRes.rows[0]?.total_revenue || 0;

    // Sum up attributed revenue across all completed campaigns
    let totalAttributedRevenue = 0;
    let totalROI = 0;
    let roiCount = 0;
    const bestCampaignData: { id: string; name: string; revenue: number; channel: string } | null = 
      healthRes.rows.length > 0 ? null : null;
    const worstCampaignData: { id: string; name: string; revenue: number; channel: string } | null = null;

    const campaignRevenues: Array<{ id: string; name: string; revenue: number; channel: string; roi: number }> = [];
    for (const row of healthRes.rows) {
      const rev = await getCampaignRevenue(row.id);
      totalAttributedRevenue += rev;
      const unitCost = CHANNEL_COSTS[row.channel.toUpperCase() as keyof typeof CHANNEL_COSTS] || 0.15;
      const cost = (row.sent || 0) * unitCost;
      const roi = cost > 0 ? ((rev - cost) / cost) * 100 : 0;
      totalROI += roi;
      roiCount++;
      campaignRevenues.push({ id: row.id, name: row.name, revenue: rev, channel: row.channel, roi });
    }

    const avgCampaignROI = roiCount > 0 ? Math.round(totalROI / roiCount) : 0;
    const revenueAttributionPct = totalRevenue > 0 
      ? Math.round((totalAttributedRevenue / totalRevenue) * 100)
      : 0;

    // Best and worst campaigns by attributed revenue
    const sorted = [...campaignRevenues].sort((a, b) => b.revenue - a.revenue);
    const bestCampaign = sorted.length > 0 
      ? { id: sorted[0].id, name: sorted[0].name, revenue: sorted[0].revenue, channel: sorted[0].channel }
      : null;
    const worstCampaign = sorted.length > 1
      ? { id: sorted[sorted.length - 1].id, name: sorted[sorted.length - 1].name, revenue: sorted[sorted.length - 1].revenue, channel: sorted[sorted.length - 1].channel }
      : null;

    return {
      campaignHealthScore,
      audienceQualityScore,
      topConvertingCity,
      revenueAttributionPct,
      bestCampaign,
      worstCampaign,
      totalAttributedRevenue,
      avgCampaignROI
    };
  } catch (error) {
    console.error('Failed to calculate CRM health:', error);
    return {
      campaignHealthScore: 0,
      audienceQualityScore: 0,
      topConvertingCity: 'N/A',
      revenueAttributionPct: 0,
      bestCampaign: null,
      worstCampaign: null,
      totalAttributedRevenue: 0,
      avgCampaignROI: 0
    };
  }
}
