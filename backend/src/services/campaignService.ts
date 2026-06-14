import { db } from '../db/index';
import * as schema from '../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { getAudienceIds } from './segmentCompiler';
import { CreateCampaignData, CampaignLaunchResult, CampaignStatus } from '../types/campaign';

/**
 * Creates a new marketing campaign in DRAFT state.
 * Validates target segment existence, channel validation, and templates.
 */
export async function createCampaign(data: CreateCampaignData): Promise<typeof schema.campaigns.$inferSelect> {
  const { segmentId, name, channel, messageTemplate } = data;

  // 1. Validate inputs
  if (!name || name.trim() === '') {
    throw new Error('Campaign name cannot be empty');
  }
  if (!messageTemplate || messageTemplate.trim() === '') {
    throw new Error('Message template cannot be empty');
  }
  
  const validChannels = ['WHATSAPP', 'SMS', 'EMAIL', 'RCS'];
  if (!validChannels.includes(channel.toUpperCase())) {
    throw new Error(`Invalid communication channel: ${channel}. Must be one of: ${validChannels.join(', ')}`);
  }

  if (!segmentId) {
    throw new Error('Campaign must be associated with a segment');
  }

  // 2. Validate segment exists
  const segmentRecord = await db
    .select()
    .from(schema.segments)
    .where(eq(schema.segments.id, segmentId))
    .limit(1);

  if (segmentRecord.length === 0) {
    throw new Error(`Target Segment ID ${segmentId} does not exist`);
  }

  // 3. Create Draft campaign record
  const result = await db
    .insert(schema.campaigns)
    .values({
      segmentId,
      name,
      channel: channel.toUpperCase(),
      messageTemplate,
      status: 'DRAFT',
      audienceSize: 0
    })
    .returning();

  return result[0];
}

/**
 * Atomic transaction mapping dynamic target cohorts to campaign snapshots.
 * Evaluates target segments and creates pending jobs, transitioning the status to RUNNING.
 */
export async function launchCampaign(id: string): Promise<CampaignLaunchResult> {
  // 1. Verify campaign exists
  const campaignRecord = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, id))
    .limit(1);

  if (campaignRecord.length === 0) {
    throw new Error(`Campaign ID ${id} does not exist`);
  }

  const campaign = campaignRecord[0];
  
  // 2. State-change validation
  if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
    throw new Error(`Campaign cannot be launched from status: ${campaign.status}`);
  }

  if (!campaign.segmentId) {
    throw new Error('Campaign has no associated segment for execution');
  }

  // 3. Fetch rules and execute segmentation query to list matched customer IDs
  const segmentRecord = await db
    .select()
    .from(schema.segments)
    .where(eq(schema.segments.id, campaign.segmentId))
    .limit(1);

  if (segmentRecord.length === 0) {
    throw new Error(`Target Segment ID ${campaign.segmentId} does not exist`);
  }

  const rules = segmentRecord[0].rulesJson;
  const matchedCustomerIds = await getAudienceIds(rules as any);

  // 4. Validate audience size > 0
  if (matchedCustomerIds.length === 0) {
    throw new Error('Dynamic target segment returned an empty audience cohort. Campaign cannot launch.');
  }

  // 5. Execute launch transaction
  await db.transaction(async (tx) => {
    // a. Update campaign stats & status
    await tx
      .update(schema.campaigns)
      .set({
        status: 'RUNNING',
        audienceSize: matchedCustomerIds.length
      })
      .where(eq(schema.campaigns.id, id));

    // b. Write snapshotted customers into campaign_audience
    const audienceInsertions = matchedCustomerIds.map(customerId => ({
      campaignId: id,
      customerId
    }));

    // Chunk size execution to prevent PostgreSQL params exhaustion
    for (let idx = 0; idx < audienceInsertions.length; idx += 1000) {
      const chunk = audienceInsertions.slice(idx, idx + 1000);
      await tx.insert(schema.campaignAudience).values(chunk);
    }

    // c. Write pending communication jobs
    const jobInsertions = matchedCustomerIds.map(customerId => ({
      campaignId: id,
      customerId,
      status: 'PENDING'
    }));

    for (let idx = 0; idx < jobInsertions.length; idx += 1000) {
      const chunk = jobInsertions.slice(idx, idx + 1000);
      await tx.insert(schema.communicationJobs).values(chunk);
    }
  });

  return {
    campaignId: id,
    audienceSize: matchedCustomerIds.length,
    status: 'RUNNING',
    jobsDispatched: matchedCustomerIds.length
  };
}

/**
 * Returns a specific campaign record.
 */
export async function getCampaign(id: string): Promise<typeof schema.campaigns.$inferSelect> {
  const result = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, id))
    .limit(1);

  if (result.length === 0) {
    throw new Error(`Campaign ID ${id} not found`);
  }

  return result[0];
}

/**
 * Lists all marketing campaigns in the CRM.
 */
export async function listCampaigns(): Promise<typeof schema.campaigns.$inferSelect[]> {
  return await db.select().from(schema.campaigns);
}

/**
 * Cancels a scheduled or running campaign.
 * Transitions pending/processing jobs to CANCELLED.
 */
export async function cancelCampaign(id: string): Promise<typeof schema.campaigns.$inferSelect> {
  const campaignRecord = await getCampaign(id);

  if (campaignRecord.status !== 'SCHEDULED' && campaignRecord.status !== 'RUNNING') {
    throw new Error(`Campaign in ${campaignRecord.status} state cannot be cancelled`);
  }

  await db.transaction(async (tx) => {
    // Update campaign
    await tx
      .update(schema.campaigns)
      .set({ status: 'CANCELLED' })
      .where(eq(schema.campaigns.id, id));

    // Update PENDING/PROCESSING communication jobs
    await tx
      .update(schema.communicationJobs)
      .set({ status: 'FAILED' }) // Map cancel status to Failed in jobs or create job cancellation state
      .where(
        and(
          eq(schema.communicationJobs.campaignId, id),
          or(
            eq(schema.communicationJobs.status, 'PENDING'),
            eq(schema.communicationJobs.status, 'PROCESSING')
          )
        )
      );
  });

  return await getCampaign(id);
}
