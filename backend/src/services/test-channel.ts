import { db } from '../db/index';
import * as schema from '../db/schema';
import { createCampaign, launchCampaign } from './campaignService';
import { processPendingJobs } from './channelService';
import { eq } from 'drizzle-orm';

async function testChannelServiceFlow() {
  console.log('--- Starting Stub Channel Service Integration Tests ---');

  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL is not set. Skipping database integration tests.');
    process.exit(0);
  }

  try {
    // Clear old communication records to isolate the test execution
    console.log('Clearing old communication jobs and events...');
    await db.delete(schema.communicationEvents);
    await db.delete(schema.communicationJobs);

    // 1. Setup a test segment that matches a customer
    // Create a unique temporary customer in a unique city to isolate exactly 1 test target
    const uniqueCity = `TestCity_${Date.now()}`;
    const testCust = await db.insert(schema.customers).values({
      firstName: 'Channel',
      lastName: 'Test',
      email: `channeltest_${Date.now()}@xeno-crm.in`,
      phone: `+910000${Date.now().toString().slice(-6)}`,
      city: uniqueCity
    }).returning();
    
    const customer = testCust[0];
    console.log(`Targeting unique customer: ${customer.firstName} ${customer.lastName} in ${customer.city}`);

    // Create a specific segment targeting this customer's city
    const segmentResult = await db
      .insert(schema.segments)
      .values({
        name: `Test Cohort in ${customer.city}`,
        description: 'Test segment for channel dispatcher',
        rulesJson: {
          type: 'group',
          logic: 'AND',
          children: [
            { type: 'condition', field: 'city', operator: '=', value: customer.city }
          ]
        }
      })
      .returning();

    const segment = segmentResult[0];

    // 2. Create and launch a test campaign
    console.log('Creating campaign...');
    const campaign = await createCampaign({
      segmentId: segment.id,
      name: 'Simulated Launch Alert',
      channel: 'WHATSAPP',
      messageTemplate: 'Hello {{firstName}}, checking delivery logs!'
    });

    console.log('Launching campaign...');
    const launchResult = await launchCampaign(campaign.id);
    console.log(`Dispatched ${launchResult.jobsDispatched} jobs. Campaign state: ${launchResult.status}`);

    // Verify jobs are PENDING
    const initialJobs = await db
      .select()
      .from(schema.communicationJobs)
      .where(eq(schema.communicationJobs.campaignId, campaign.id));
    
    console.log(`Confirmed ${initialJobs.length} PENDING jobs created in database.`);

    // 3. Process the Pending Jobs
    console.log('Triggering processPendingJobs()...');
    const processedJobs = await processPendingJobs();
    console.log(`Processed ${processedJobs} jobs.`);

    // 4. Verify Job Outcome & Campaign Transition
    const finalJobs = await db
      .select()
      .from(schema.communicationJobs)
      .where(eq(schema.communicationJobs.campaignId, campaign.id));
    
    const allProcessed = finalJobs.every(job => job.status === 'SUCCESS' || job.status === 'FAILED');
    if (!allProcessed) throw new Error('Not all jobs completed successfully or failed');
    console.log('✅ Confirmed all dispatch jobs completed processing.');

    const updatedCampaign = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaign.id))
      .limit(1);

    if (updatedCampaign[0].status !== 'COMPLETED') {
      throw new Error(`Expected Campaign state to be COMPLETED, but found ${updatedCampaign[0].status}`);
    }
    console.log('✅ Confirmed campaign state transitioned to COMPLETED.');

    // 5. Verify Event Logs & Sequential Timestamps
    const events = await db
      .select()
      .from(schema.communicationEvents)
      .where(eq(schema.communicationEvents.campaignId, campaign.id))
      .orderBy(schema.communicationEvents.timestamp);

    console.log(`Generated ${events.length} sequential event logs:`);
    events.forEach(event => {
      console.log(`  - ${event.eventType} at ${event.timestamp.toISOString()} (Metadata: ${JSON.stringify(event.metadataJson)})`);
    });

    // Check timestamps are progressive
    if (events.length > 1) {
      for (let i = 1; i < events.length; i++) {
        const t1 = events[i - 1].timestamp.getTime();
        const t2 = events[i].timestamp.getTime();
        if (t2 < t1) {
          throw new Error(`Non-progressive event timestamps found: ${events[i - 1].eventType} at ${events[i - 1].timestamp.toISOString()} followed by ${events[i].eventType} at ${events[i].timestamp.toISOString()}`);
        }
      }
      console.log('✅ Confirmed all communication events have sequential, progressive timestamps.');
    }

    // 6. Clean Up
    console.log('Cleaning up test records...');
    await db.delete(schema.campaigns).where(eq(schema.campaigns.id, campaign.id));
    await db.delete(schema.segments).where(eq(schema.segments.id, segment.id));
    await db.delete(schema.customers).where(eq(schema.customers.id, customer.id));
    console.log('✅ Cleanup complete.');

    console.log('--- Stub Channel Service Integration Tests Passed Successfully ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ Stub Channel Service integration test failed:', error);
    process.exit(1);
  }
}

testChannelServiceFlow();
