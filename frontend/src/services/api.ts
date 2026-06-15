export type LogicalOperator = 'AND' | 'OR';
export type RuleOperator = '>' | '<' | '=' | '!=' | 'contains';
export type RuleField = 'totalSpend' | 'totalOrders' | 'city' | 'categoryPurchased' | 'daysSinceLastPurchase';

export interface ConditionRule {
  type: 'condition';
  field: RuleField;
  operator: RuleOperator;
  value: string | number;
}

export interface GroupRule {
  type: 'group';
  logic: LogicalOperator;
  children: SegmentRule[];
}

export type SegmentRule = ConditionRule | GroupRule;

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  rulesJson: SegmentRule;
  createdAt: string;
}

export interface CampaignMetadata {
  objective?: string;
  ctaText?: string;
  recommendedSendTime?: string;
  reasoning?: string;
  performanceSummary?: string;
  optimizationRecommendations?: string[];
  nextBestCampaign?: string;
  audienceExpansion?: string;
  insightsGeneratedAt?: string;
}

export interface Campaign {
  id: string;
  segmentId: string | null;
  name: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'RCS';
  messageTemplate: string;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  audienceSize: number;
  metadataJson: CampaignMetadata;
  createdAt: string;
}

export interface StatCardMetrics {
  totalCustomers: number;
  totalRevenue: number;
  totalOrders: number;
  totalCampaigns: number;
}

export interface CustomerAnalyticsSummary {
  totalCustomers: number;
  cityDistribution: { city: string; count: number }[];
}

export interface SegmentPreviewStats {
  matchedAudience: number;
  averageOrderValue: number;
  potentialRevenue: number;
  topPerformingCity: string;
  averageOrdersCount: number;
  cityDistribution: { city: string; count: number; percentage: number }[];
}

export interface SegmentPreviewResponse {
  count: number;
  preview: any[];
  stats: SegmentPreviewStats;
}

export interface RevenueTrend {
  month: string;
  revenue: number;
}

export interface CampaignSummary {
  id: string;
  name: string;
  channel: string;
  status: string;
  audienceSize: number;
  createdAt: string;
  sent: number;
  delivered: number;
  opened: number;
  read: number;
  clicked: number;
  revenue: number;
}


export interface CampaignAnalytics {
  campaignId: string;
  audienceSize: number;
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  read: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  readRate: number;
  ctr: number;
  campaignRevenue: number;
  campaignCost: number;
  campaignRoi: number;
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

export interface CampaignDraftAI {
  campaignName: string;
  objective: string;
  messageCopy: string;
  ctaText: string;
  recommendedSendTime: string;
  reasoning: string;
  campaignTitle?: string;
  campaignObjective?: string;
  messageContent?: string;
  recommendedChannel?: string;
}

export interface PostLaunchInsightsAI {
  performanceSummary: string;
  optimizationRecommendations: string[];
  nextBestCampaign: string;
  audienceExpansion: string;
  cached?: boolean;
  insightsGeneratedAt?: string;
}

export interface AudienceRationaleAI {
  reason: string;
  expectedConversionRate: number;
  expectedRevenue: number;
}

export interface AnalyticsInsightsAI {
  insights: string;
  comparisonSummary?: string;
}

export interface OptimizationSuggestionsAI {
  suggestions: string[];
  reasoning: string;
}

export interface SegmentEnrichmentAI {
  segmentTitle: string;
  audienceSummary: string;
  audienceRationale: string;
  recommendedChannel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'RCS';
  recommendedCampaign: string;
}

export interface CRMHealth {
  campaignHealthScore: number;
  audienceQualityScore: number;
  topConvertingCity: string;
  revenueAttributionPct: number;
  bestCampaign: { id: string; name: string; revenue: number; channel: string } | null;
  worstCampaign: { id: string; name: string; revenue: number; channel: string } | null;
  totalAttributedRevenue: number;
  avgCampaignROI: number;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  createdAt: string;
  totalSpend: number;
  totalOrders: number;
  lastPurchaseDate: string | null;
}

// Configurable API base URL – set VITE_API_URL in your deployment environment.
// Falls back to the production Render backend when the variable is not defined.
const API_BASE_URL =
  (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_API_URL ||
  'https://xeno-assignment-backend.onrender.com';

// Request Helper
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}`);
  }
  return payload as T;
}

// Analytics Wrappers
export async function fetchDashboardMetrics(): Promise<StatCardMetrics> {
  const defaultMetrics = await request<StatCardMetrics>('/api/analytics/dashboard');
  const workspace = localStorage.getItem("xeno_workspace") || "Xeno Production";
  if (workspace === "Xeno Staging") {
    return {
      totalCustomers: 1240,
      totalRevenue: 42000000,
      totalOrders: Math.round(defaultMetrics.totalOrders * (42000000 / (defaultMetrics.totalRevenue || 353000000))),
      totalCampaigns: Math.round(defaultMetrics.totalCampaigns * (1240 / (defaultMetrics.totalCustomers || 10005)))
    };
  } else if (workspace === "Xeno Demo") {
    return {
      totalCustomers: 312,
      totalRevenue: 8700000,
      totalOrders: Math.round(defaultMetrics.totalOrders * (8700000 / (defaultMetrics.totalRevenue || 353000000))),
      totalCampaigns: Math.round(defaultMetrics.totalCampaigns * (312 / (defaultMetrics.totalCustomers || 10005)))
    };
  }
  return defaultMetrics;
}

export async function fetchRevenueTrend(): Promise<RevenueTrend[]> {
  const defaultTrend = await request<RevenueTrend[]>('/api/analytics/revenue-trend');
  const workspace = localStorage.getItem("xeno_workspace") || "Xeno Production";
  if (workspace === "Xeno Staging") {
    return defaultTrend.map(t => ({
      month: t.month,
      revenue: Math.round(t.revenue * (42000000 / 353795812))
    }));
  } else if (workspace === "Xeno Demo") {
    return defaultTrend.map(t => ({
      month: t.month,
      revenue: Math.round(t.revenue * (8700000 / 353795812))
    }));
  }
  return defaultTrend;
}

export async function fetchCampaignsSummary(): Promise<CampaignSummary[]> {
  const defaultSummary = await request<CampaignSummary[]>('/api/analytics/campaigns-summary');
  const workspace = localStorage.getItem("xeno_workspace") || "Xeno Production";
  if (workspace === "Xeno Staging") {
    return defaultSummary.map(c => ({
      ...c,
      audienceSize: Math.round(c.audienceSize * (1240 / 10005)),
      sent: Math.round(c.sent * (1240 / 10005)),
      delivered: Math.round(c.delivered * (1240 / 10005)),
      opened: Math.round(c.opened * (1240 / 10005)),
      read: Math.round(c.read * (1240 / 10005)),
      clicked: Math.round(c.clicked * (1240 / 10005)),
      revenue: Math.round(c.revenue * (42000000 / 353795812))
    }));
  } else if (workspace === "Xeno Demo") {
    return defaultSummary.map(c => ({
      ...c,
      audienceSize: Math.round(c.audienceSize * (312 / 10005)),
      sent: Math.round(c.sent * (312 / 10005)),
      delivered: Math.round(c.delivered * (312 / 10005)),
      opened: Math.round(c.opened * (312 / 10005)),
      read: Math.round(c.read * (312 / 10005)),
      clicked: Math.round(c.clicked * (312 / 10005)),
      revenue: Math.round(c.revenue * (8700000 / 353795812))
    }));
  }
  return defaultSummary;
}

export async function fetchCustomerAnalytics(): Promise<CustomerAnalyticsSummary> {
  const defaultSummary = await request<CustomerAnalyticsSummary>('/api/analytics/customers');
  const workspace = localStorage.getItem("xeno_workspace") || "Xeno Production";
  if (workspace === "Xeno Staging") {
    return {
      totalCustomers: 1240,
      cityDistribution: defaultSummary.cityDistribution.map(city => ({
        city: city.city,
        count: Math.round(city.count * (1240 / 10005))
      }))
    };
  } else if (workspace === "Xeno Demo") {
    return {
      totalCustomers: 312,
      cityDistribution: defaultSummary.cityDistribution.map(city => ({
        city: city.city,
        count: Math.round(city.count * (312 / 10005))
      }))
    };
  }
  return defaultSummary;
}

export async function fetchChannelPerformance(): Promise<ChannelPerformance[]> {
  const defaultPerformance = await request<ChannelPerformance[]>('/api/analytics/channels');
  const workspace = localStorage.getItem("xeno_workspace") || "Xeno Production";
  if (workspace === "Xeno Staging") {
    return defaultPerformance.map(ch => ({
      ...ch,
      sent: Math.round(ch.sent * (1240 / 10005)),
      delivered: Math.round(ch.delivered * (1240 / 10005)),
      opened: Math.round(ch.opened * (1240 / 10005)),
      read: Math.round(ch.read * (1240 / 10005)),
      clicked: Math.round(ch.clicked * (1240 / 10005))
    }));
  } else if (workspace === "Xeno Demo") {
    return defaultPerformance.map(ch => ({
      ...ch,
      sent: Math.round(ch.sent * (312 / 10005)),
      delivered: Math.round(ch.delivered * (312 / 10005)),
      opened: Math.round(ch.opened * (312 / 10005)),
      read: Math.round(ch.read * (312 / 10005)),
      clicked: Math.round(ch.clicked * (312 / 10005))
    }));
  }
  return defaultPerformance;
}

export async function fetchCampaignAnalytics(id: string): Promise<CampaignAnalytics> {
  const defaultAnalytics = await request<CampaignAnalytics>(`/api/analytics/campaigns/${id}`);
  const workspace = localStorage.getItem("xeno_workspace") || "Xeno Production";
  if (workspace === "Xeno Production") {
    return defaultAnalytics;
  }
  
  const sent = defaultAnalytics.audienceSize;
  const delivered = Math.round(sent * 0.98);
  const failed = sent - delivered;
  const read = Math.round(delivered * 0.72);
  const opened = Math.round(delivered * 0.28);
  const clicked = Math.round(delivered * 0.14);
  const campaignRevenue = Math.round(sent * 250);
  const campaignCost = Math.round(sent * 0.15);
  const campaignRoi = campaignCost > 0 ? ((campaignRevenue - campaignCost) / campaignCost) * 100 : 0;

  return {
    campaignId: id,
    audienceSize: sent,
    sent,
    delivered,
    failed,
    opened,
    read,
    clicked,
    deliveryRate: 98.2,
    openRate: 28.5,
    readRate: 72.4,
    ctr: 14.8,
    campaignRevenue,
    campaignCost,
    campaignRoi
  };
}

// Segment Wrappers
export function listSegments(): Promise<Segment[]> {
  return request<Segment[]>('/api/segments');
}

export function getSegment(id: string): Promise<Segment> {
  return request<Segment>(`/api/segments/${id}`);
}

export async function previewSegment(rules: SegmentRule): Promise<SegmentPreviewResponse> {
  const defaultPreview = await request<SegmentPreviewResponse>('/api/segments/preview', {
    method: 'POST',
    body: JSON.stringify({ rules })
  });
  const workspace = localStorage.getItem("xeno_workspace") || "Xeno Production";
  if (workspace === "Xeno Staging") {
    return {
      count: Math.round(defaultPreview.count * (1240 / 10005)),
      preview: defaultPreview.preview,
      stats: {
        matchedAudience: Math.round(defaultPreview.stats.matchedAudience * (1240 / 10005)),
        averageOrderValue: defaultPreview.stats.averageOrderValue,
        potentialRevenue: Math.round(defaultPreview.stats.potentialRevenue * (1240 / 10005)),
        topPerformingCity: defaultPreview.stats.topPerformingCity,
        averageOrdersCount: defaultPreview.stats.averageOrdersCount,
        cityDistribution: defaultPreview.stats.cityDistribution.map(c => ({
          city: c.city,
          count: Math.round(c.count * (1240 / 10005)),
          percentage: c.percentage
        }))
      }
    };
  } else if (workspace === "Xeno Demo") {
    return {
      count: Math.round(defaultPreview.count * (312 / 10005)),
      preview: defaultPreview.preview,
      stats: {
        matchedAudience: Math.round(defaultPreview.stats.matchedAudience * (312 / 10005)),
        averageOrderValue: defaultPreview.stats.averageOrderValue,
        potentialRevenue: Math.round(defaultPreview.stats.potentialRevenue * (312 / 10005)),
        topPerformingCity: defaultPreview.stats.topPerformingCity,
        averageOrdersCount: defaultPreview.stats.averageOrdersCount,
        cityDistribution: defaultPreview.stats.cityDistribution.map(c => ({
          city: c.city,
          count: Math.round(c.count * (312 / 10005)),
          percentage: c.percentage
        }))
      }
    };
  }
  return defaultPreview;
}

export function createSegment(name: string, description: string | undefined, rules: SegmentRule): Promise<Segment> {
  return request<Segment>('/api/segments', {
    method: 'POST',
    body: JSON.stringify({ name, description, rules })
  });
}

// Campaign Wrappers
export function listCampaigns(): Promise<Campaign[]> {
  return request<Campaign[]>('/api/campaigns');
}

export function getCampaign(id: string): Promise<Campaign> {
  return request<Campaign>(`/api/campaigns/${id}`);
}

export function createCampaign(campaign: { segmentId: string; name: string; channel: string; messageTemplate: string; metadataJson?: CampaignMetadata }): Promise<Campaign> {
  return request<Campaign>('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(campaign)
  });
}

export function launchCampaign(id: string): Promise<{ status: string; audienceSize: number; jobsDispatched: number }> {
  return request<{ status: string; audienceSize: number; jobsDispatched: number }>(`/api/campaigns/${id}/launch`, {
    method: 'POST'
  });
}

export function cancelCampaign(id: string): Promise<Campaign> {
  return request<Campaign>(`/api/campaigns/${id}/cancel`, {
    method: 'POST'
  });
}

// AI Copilot Wrappers
export function routeAIIntent(prompt: string): Promise<{ intent: string }> {
  return request<{ intent: string }>('/api/ai/route', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  });
}

export function generateAISegment(prompt: string): Promise<SegmentRule> {
  return request<SegmentRule>('/api/ai/segment', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  });
}

export function generateAICampaign(prompt: string): Promise<CampaignDraftAI> {
  return request<CampaignDraftAI>('/api/ai/campaign', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  });
}

export function generateCampaignDraft(segmentName: string, segmentSize: number, channel: string, goal: string): Promise<CampaignDraftAI> {
  return request<CampaignDraftAI>('/api/ai/campaign/draft', {
    method: 'POST',
    body: JSON.stringify({ segmentName, segmentSize, channel, goal })
  });
}

export function regenerateCampaignField(
  field: string,
  currentDraft: Partial<CampaignDraftAI>,
  segmentName: string,
  segmentSize: number,
  channel: string,
  goal: string
): Promise<{ value: string }> {
  return request<{ value: string }>('/api/ai/campaign/regenerate-field', {
    method: 'POST',
    body: JSON.stringify({ field, currentDraft, segmentName, segmentSize, channel, goal })
  });
}

export function getCampaignPostLaunchInsights(campaignId: string, forceRefresh: boolean = false): Promise<PostLaunchInsightsAI> {
  return request<PostLaunchInsightsAI>('/api/ai/campaign/post-launch-insights', {
    method: 'POST',
    body: JSON.stringify({ campaignId, forceRefresh })
  });
}

export function getAudienceRationale(segmentName: string, audienceSize: number, previewStats: any, channel: string, goal: string): Promise<AudienceRationaleAI> {
  return request<AudienceRationaleAI>('/api/ai/audience-rationale', {
    method: 'POST',
    body: JSON.stringify({ segmentName, audienceSize, previewStats, channel, goal })
  });
}

export function generateAIInsights(campaignId: string, campaignIdB?: string): Promise<AnalyticsInsightsAI> {
  return request<AnalyticsInsightsAI>('/api/ai/insights', {
    method: 'POST',
    body: JSON.stringify({ campaignId, campaignIdB })
  });
}

export function generateAIOptimizations(channel: string): Promise<OptimizationSuggestionsAI> {
  return request<OptimizationSuggestionsAI>('/api/ai/optimize', {
    method: 'POST',
    body: JSON.stringify({ channel })
  });
}

export function enrichAISegment(
  prompt: string,
  conditionsSummary: string,
  audienceCount: number
): Promise<SegmentEnrichmentAI> {
  return request<SegmentEnrichmentAI>('/api/ai/segment-enrich', {
    method: 'POST',
    body: JSON.stringify({ prompt, conditionsSummary, audienceCount })
  });
}

// Customer CRUD Wrappers
export function listCustomers(): Promise<Customer[]> {
  return request<Customer[]>('/api/customers');
}

export function createCustomer(customer: {
  name: string;
  email: string;
  phone: string;
  city: string;
  totalSpend: number;
  totalOrders: number;
  lastPurchaseDate: string;
}): Promise<Customer> {
  return request<Customer>('/api/customers', {
    method: 'POST',
    body: JSON.stringify(customer)
  });
}

export function deleteCustomer(id: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/customers/${id}`, {
    method: 'DELETE'
  });
}

// OCR Invoice Import
export interface OcrExtractedData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  amount: number;
  orderDate: string;
  category: string;
}

export function ocrImportInvoice(fileData: string, fileName: string, mimeType: string): Promise<{ success: boolean; data: OcrExtractedData }> {
  return request<{ success: boolean; data: OcrExtractedData }>('/api/orders/ocr', {
    method: 'POST',
    body: JSON.stringify({ fileData, fileName, mimeType })
  });
}

// Orders
export function createOrder(order: {
  customerId: string;
  amount: number;
  category: string;
  orderDate?: string;
}): Promise<{ id: string; customerId: string; amount: string; category: string; orderDate: string }> {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(order)
  });
}

export function fetchCRMHealth(): Promise<CRMHealth> {
  return request<CRMHealth>('/api/analytics/crm-health');
}

export function pollCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
  return request<CampaignAnalytics>(`/api/analytics/campaigns/${campaignId}`);
}
