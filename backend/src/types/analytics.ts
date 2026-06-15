export interface CampaignAnalytics {
  campaignId: string;
  audienceSize: number;
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  read: number;
  clicked: number;
  
  // Rates (percentages)
  deliveryRate: number;
  openRate: number;
  readRate: number;
  ctr: number;

  // Attribution Metrics
  campaignRevenue: number;
  campaignCost: number;
  campaignRoi: number;
}

export interface CampaignSummary {
  id: string;
  name: string;
  channel: string;
  status: string;
  audienceSize: number;
  createdAt: Date;
  sent: number;
  delivered: number;
  opened: number;
  read: number;
  clicked: number;
  revenue: number;
}

export interface CustomerAnalyticsSummary {
  totalCustomers: number;
  cityDistribution: { city: string; count: number }[];
}

export interface ChannelPerformance {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  read: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  readRate: number;
  ctr: number;
}

export interface DashboardMetrics {
  totalCustomers: number;
  totalRevenue: number;
  totalOrders: number;
  totalCampaigns: number;
}

export interface RevenueTrend {
  month: string;
  revenue: number;
}

export interface CRMHealth {
  campaignHealthScore: number;        // 0-100, weighted avg of delivery+ctr
  audienceQualityScore: number;       // % of customers with ≥1 order
  topConvertingCity: string;          // city with highest clicked events per delivered
  revenueAttributionPct: number;      // attributed revenue / total revenue × 100
  bestCampaign: { id: string; name: string; revenue: number; channel: string } | null;
  worstCampaign: { id: string; name: string; revenue: number; channel: string } | null;
  totalAttributedRevenue: number;
  avgCampaignROI: number;
}

