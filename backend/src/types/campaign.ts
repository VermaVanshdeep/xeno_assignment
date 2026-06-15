export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type ChannelType = 'WHATSAPP' | 'SMS' | 'EMAIL' | 'RCS';

export interface CampaignMetadata {
  // Draft-time AI fields
  objective?: string;
  ctaText?: string;
  recommendedSendTime?: string;
  reasoning?: string;
  // Post-launch AI snapshot
  performanceSummary?: string;
  optimizationRecommendations?: string[];
  nextBestCampaign?: string;
  audienceExpansion?: string;
  insightsGeneratedAt?: string;
}

export interface CreateCampaignData {
  segmentId: string | null;
  name: string;
  channel: ChannelType;
  messageTemplate: string;
  metadataJson?: CampaignMetadata;
}

export interface CampaignLaunchResult {
  campaignId: string;
  audienceSize: number;
  status: CampaignStatus;
  jobsDispatched: number;
}
