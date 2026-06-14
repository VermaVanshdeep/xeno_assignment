export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type ChannelType = 'WHATSAPP' | 'SMS' | 'EMAIL' | 'RCS';

export interface CreateCampaignData {
  segmentId: string | null;
  name: string;
  channel: ChannelType;
  messageTemplate: string;
}

export interface CampaignLaunchResult {
  campaignId: string;
  audienceSize: number;
  status: CampaignStatus;
  jobsDispatched: number;
}
