import { db } from '../db/index';
import * as schema from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';

// Channel specific outcome probabilities
const PROBABILITIES = {
  WHATSAPP: { delivered: 0.98, read: 0.92, clicked: 0.18 },
  SMS:      { delivered: 0.95, read: 0.70, clicked: 0.08 },
  EMAIL:    { delivered: 0.90, read: 0.35, clicked: 0.12 },
  RCS:      { delivered: 0.96, read: 0.80, clicked: 0.15 }
};

/**
 * Polls the database for PENDING communication jobs and dispatches them.
 */
export async function processPendingJobs(): Promise<number> {
  // 1. Fetch PENDING jobs up to a limit of 100 to avoid long blocking periods
  const pendingJobs = await db
    .select()
    .from(schema.communicationJobs)
    .where(eq(schema.communicationJobs.status, 'PENDING'))
    .limit(100);

  console.log(`[channel-service]: Polled and found ${pendingJobs.length} PENDING jobs to process.`);

  if (pendingJobs.length === 0) {
    return 0;
  }

  let processedCount = 0;
  
  // Process in chunks of 10 concurrently to run faster without overwhelming DB connections
  const chunkSize = 10;
  for (let i = 0; i < pendingJobs.length; i += chunkSize) {
    const chunk = pendingJobs.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (job) => {
      try {
        await processJob(job.id);
        processedCount++;
      } catch (e) {
        console.error(`[channel-service]: Failed to process job ${job.id}:`, e);
      }
    }));
  }

  return processedCount;
}

/**
 * Processes a single communication job in an atomic transaction boundary.
 */
export async function processJob(jobId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Mark job as PROCESSING atomically if it is currently PENDING (prevent race conditions)
    const updated = await tx
      .update(schema.communicationJobs)
      .set({ 
        status: 'PROCESSING',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(schema.communicationJobs.id, jobId),
          eq(schema.communicationJobs.status, 'PENDING')
        )
      )
      .returning();

    if (updated.length === 0) {
      // Already claimed or updated by another process/transaction
      return;
    }

    const job = updated[0];

    // 2. Fetch corresponding Campaign for templates and channel type
    const campaignRecord = await tx
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, job.campaignId))
      .limit(1);

    if (campaignRecord.length === 0) {
      throw new Error(`Campaign associated with Job ${jobId} does not exist`);
    }

    const campaign = campaignRecord[0];
    const channel = (campaign.channel || 'SMS').toUpperCase() as keyof typeof PROBABILITIES;
    const probability = PROBABILITIES[channel] || PROBABILITIES.SMS;

    // 3. Run probability model and generate events sequentially
    const now = new Date();
    
    // a. Create SENT Event
    const sentEventId = crypto.randomUUID();
    await tx.insert(schema.communicationEvents).values({
      id: sentEventId,
      campaignId: job.campaignId,
      customerId: job.customerId,
      eventType: 'SENT',
      timestamp: now,
      metadataJson: { channel, messageId: `msg-${sentEventId.slice(0, 8)}` }
    });

    // b. Roll for Delivery
    const isDelivered = Math.random() < probability.delivered;

    if (!isDelivered) {
      // Create FAILED Event (timestamp: sent + 1 second)
      const failedTime = new Date(now.getTime() + 1000);
      await tx.insert(schema.communicationEvents).values({
        campaignId: job.campaignId,
        customerId: job.customerId,
        eventType: 'FAILED',
        timestamp: failedTime,
        metadataJson: { channel, failureReason: 'Carrier dispatch rejection', errorDescription: 'Simulated network drop' }
      });

      // Update Job status to FAILED
      await tx
        .update(schema.communicationJobs)
        .set({
          status: 'FAILED',
          lastError: 'Simulated carrier delivery failure',
          updatedAt: new Date()
        })
        .where(eq(schema.communicationJobs.id, jobId));
    } else {
      // Create DELIVERED Event (timestamp: sent + 2 seconds)
      const deliveredTime = new Date(now.getTime() + 2000);
      await tx.insert(schema.communicationEvents).values({
        campaignId: job.campaignId,
        customerId: job.customerId,
        eventType: 'DELIVERED',
        timestamp: deliveredTime,
        metadataJson: { channel, messageId: `msg-${sentEventId.slice(0, 8)}` }
      });

      // Roll for Open/Read (WhatsApp/RCS use READ, Email uses OPENED, SMS uses READ/OPENED equivalent)
      const isRead = Math.random() < probability.read;

      if (isRead) {
        // Create OPENED/READ Event (timestamp: delivered + 15 seconds)
        const readTime = new Date(deliveredTime.getTime() + 15000);
        const eventType = channel === 'EMAIL' ? 'OPENED' : 'READ';
        await tx.insert(schema.communicationEvents).values({
          campaignId: job.campaignId,
          customerId: job.customerId,
          eventType,
          timestamp: readTime,
          metadataJson: { channel }
        });

        // Roll for Click
        const isClicked = Math.random() < probability.clicked;

        if (isClicked) {
          // Create CLICKED Event (timestamp: read + 45 seconds)
          const clickedTime = new Date(readTime.getTime() + 45000);
          await tx.insert(schema.communicationEvents).values({
            campaignId: job.campaignId,
            customerId: job.customerId,
            eventType: 'CLICKED',
            timestamp: clickedTime,
            metadataJson: { channel, linkTarget: 'https://xeno-crm.in/promo-destination' }
          });

          // Simulate purchase event (order conversion: 20% of clicks result in purchase)
          const isPurchase = Math.random() < 0.20;
          if (isPurchase) {
            const purchaseTime = new Date(clickedTime.getTime() + 5000); // 5 seconds after click
            const amount = (Math.random() * 8000 + 500).toFixed(2);
            const categories = ['Fashion', 'Beauty', 'Coffee', 'Lifestyle', 'Electronics'];
            const category = categories[Math.floor(Math.random() * categories.length)];
            
            await tx.insert(schema.orders).values({
              customerId: job.customerId,
              amount: amount,
              category: category,
              orderDate: purchaseTime
            });
            console.log(`[channel-service]: Simulated conversion purchase of ₹${amount} for customer ${job.customerId}`);
          }
        }
      }

      // Update Job status to SUCCESS
      await tx
        .update(schema.communicationJobs)
        .set({
          status: 'SUCCESS',
          updatedAt: new Date()
        })
        .where(eq(schema.communicationJobs.id, jobId));
    }

    // 5. Check campaign completion rule
    await completeCampaignIfFinished(tx, job.campaignId);
  });
}

/**
 * Checks if all communication jobs for a campaign are complete,
 * and updates the campaign status to COMPLETED when finished.
 * 
 * Runs within the caller's transaction context.
 */
export async function completeCampaignIfFinished(tx: any, campaignId: string): Promise<void> {
  const remainingJobs = await tx
    .select()
    .from(schema.communicationJobs)
    .where(
      and(
        eq(schema.communicationJobs.campaignId, campaignId),
        inArray(schema.communicationJobs.status, ['PENDING', 'PROCESSING'])
      )
    );

  if (remainingJobs.length === 0) {
    console.log(`[channel-service]: All jobs for Campaign ${campaignId} processed. Transitioning to COMPLETED.`);
    await tx
      .update(schema.campaigns)
      .set({ status: 'COMPLETED' })
      .where(eq(schema.campaigns.id, campaignId));
  }
}
