import { db } from '../db/index';
import * as schema from '../db/schema';
import { createCampaign, launchCampaign, getCampaign, cancelCampaign } from './campaignService';
import { eq } from 'drizzle-orm';

async function testCampaignFlow() {
  console.log('--- Starting Campaign Engine Flow Integration Tests ---');
  
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL is not set. Skipping database integration tests.');
    process.exit(0);
  }

  try {
    // 1. Create a mock segment for targeting
    console.log('Creating mock segment...');
    const segmentResult = await db
      .insert(schema.segments)
      .values({
        name: 'Mumbai coffee lovers test',
        description: 'Test segment for campaign runner',
        rulesJson: {
          type: 'group',
          logic: 'AND',
          children: [
            { type: 'condition', field: 'city', operator: '=', value: 'Mumbai' },
            { type: 'condition', field: 'categoryPurchased', operator: 'contains', value: 'Coffee' }
          ]
        }
      })
      .returning();
    
    const segment = segmentResult[0];
    console.log(`Created segment ID: ${segment.id}`);

    // 2. Test Input Validations
    console.log('Testing validation rules...');
    
    try {
      await createCampaign({
        segmentId: segment.id,
        name: '', // Invalid
        channel: 'SMS',
        messageTemplate: 'Hello!'
      });
      throw new Error('Validation failed to intercept empty name');
    } catch (e: any) {
      console.log(`✅ Intercepted validation: ${e.message}`);
    }

    try {
      await createCampaign({
        segmentId: segment.id,
        name: 'Spring Coffee Promo',
        channel: 'INVALID_CHANNEL' as any, // Invalid
        messageTemplate: 'Hello!'
      });
      throw new Error('Validation failed to intercept invalid channel');
    } catch (e: any) {
      console.log(`✅ Intercepted validation: ${e.message}`);
    }

    try {
      await createCampaign({
        segmentId: '00000000-0000-0000-0000-000000000000', // Non-existent segment
        name: 'Spring Coffee Promo',
        channel: 'SMS',
        messageTemplate: 'Hello!'
      });
      throw new Error('Validation failed to intercept non-existent segment');
    } catch (e: any) {
      console.log(`✅ Intercepted validation: ${e.message}`);
    }

    // 3. Test Campaign Creation
    console.log('Testing Campaign Creation...');
    const campaign = await createCampaign({
      segmentId: segment.id,
      name: 'Mumbai Morning Coffee Alert',
      channel: 'WHATSAPP',
      messageTemplate: 'Hi {{firstName}}, get 20% off coffee today in Mumbai!'
    });

    console.log(`✅ Campaign created successfully in ${campaign.status} state.`);
    
    // Assert initial campaign state
    if (campaign.status !== 'DRAFT') throw new Error('New campaign is not in DRAFT state');
    if (campaign.audienceSize !== 0) throw new Error('New campaign has non-zero audienceSize');

    // 4. Test Campaign Launch
    console.log('Testing Campaign Launch (Evaluating cohort segment and generating job buffers)...');
    
    // Check matched count to compare
    const launchResult = await launchCampaign(campaign.id);
    console.log(`✅ Campaign launched successfully!`);
    console.log(`Campaign status: ${launchResult.status}`);
    console.log(`Audience snapshotted: ${launchResult.audienceSize}`);
    console.log(`Pending jobs created: ${launchResult.jobsDispatched}`);

    // Verify database updates
    const updatedCampaign = await getCampaign(campaign.id);
    if (updatedCampaign.status !== 'RUNNING') throw new Error('Campaign state is not RUNNING after launch');
    if (updatedCampaign.audienceSize !== launchResult.audienceSize) throw new Error('Campaign database audience_size does not match launch result');

    // Verify snapshot records exist
    const snapshotRows = await db
      .select()
      .from(schema.campaignAudience)
      .where(eq(schema.campaignAudience.campaignId, campaign.id));
    
    if (snapshotRows.length !== launchResult.audienceSize) {
      throw new Error(`Expected ${launchResult.audienceSize} audience snapshot records, but found ${snapshotRows.length}`);
    }
    console.log(`✅ Confirmed ${snapshotRows.length} snapshot rows in campaign_audience.`);

    // Verify communication jobs exist
    const jobRows = await db
      .select()
      .from(schema.communicationJobs)
      .where(eq(schema.communicationJobs.campaignId, campaign.id));
    
    if (jobRows.length !== launchResult.audienceSize) {
      throw new Error(`Expected ${launchResult.audienceSize} pending communication jobs, but found ${jobRows.length}`);
    }
    
    const allPending = jobRows.every(job => job.status === 'PENDING');
    if (!allPending) throw new Error('Some dispatched jobs are not in PENDING state');
    console.log(`✅ Confirmed ${jobRows.length} communication jobs created in PENDING status.`);

    // 5. Test Cancellation
    console.log('Testing Campaign Cancellation...');
    
    // Create another campaign to cancel
    const cancelTarget = await createCampaign({
      segmentId: segment.id,
      name: 'Cancel Test Campaign',
      channel: 'SMS',
      messageTemplate: 'Test cancel template'
    });
    
    // Launch it to populate running state
    await launchCampaign(cancelTarget.id);
    
    // Cancel it
    const cancelledCampaign = await cancelCampaign(cancelTarget.id);
    if (cancelledCampaign.status !== 'CANCELLED') throw new Error('Campaign failed to transition to CANCELLED');

    // Verify corresponding jobs transitioned to FAILED
    const cancelledJobs = await db
      .select()
      .from(schema.communicationJobs)
      .where(eq(schema.communicationJobs.campaignId, cancelTarget.id));
    
    const allCancelled = cancelledJobs.every(job => job.status === 'FAILED');
    if (!allCancelled) throw new Error('Not all pending jobs were set to FAILED status upon cancellation');
    console.log('✅ Confirmed all pending communication jobs transitioned to FAILED upon cancellation.');

    // 6. Clean Up Test Records
    console.log('Cleaning up integration test records...');
    await cancelCampaign(campaign.id);
    await db.delete(schema.campaigns).where(eq(schema.campaigns.id, campaign.id));
    await db.delete(schema.campaigns).where(eq(schema.campaigns.id, cancelTarget.id));
    await db.delete(schema.segments).where(eq(schema.segments.id, segment.id));
    console.log('✅ Cleanup complete.');

    console.log('--- All Campaign Engine Flow Tests Passed Successfully ---');
    process.exit(0);

  } catch (error) {
    console.error('❌ Campaign Engine Flow integration test failed:', error);
    process.exit(1);
  }
}

testCampaignFlow();
