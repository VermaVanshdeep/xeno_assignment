import { db } from '../db/index';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { 
  getCampaignRevenue, 
  getCampaignROI, 
  getCampaignAnalytics, 
  getCampaignPerformanceSummary, 
  getCustomerAnalytics, 
  getChannelPerformance, 
  getDashboardMetrics 
} from './analyticsService';

async function testAnalyticsFlow() {
  console.log('--- Starting Analytics Engine Integration Tests ---');

  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL is not set. Skipping database integration tests.');
    process.exit(0);
  }

  try {
    // 1. Create test customers
    console.log('Creating test customers...');
    const customer1Result = await db.insert(schema.customers).values({
      firstName: 'TestFirstOne',
      lastName: 'TestLastOne',
      email: `testone_${Date.now()}@example.com`,
      phone: `9876_${Date.now()}_0`,
      city: 'Mumbai',
    }).returning();
    const c1 = customer1Result[0];

    const customer2Result = await db.insert(schema.customers).values({
      firstName: 'TestFirstTwo',
      lastName: 'TestLastTwo',
      email: `testtwo_${Date.now()}@example.com`,
      phone: `9876_${Date.now()}_1`,
      city: 'Delhi',
    }).returning();
    const c2 = customer2Result[0];

    const customer3Result = await db.insert(schema.customers).values({
      firstName: 'TestFirstThree',
      lastName: 'TestLastThree',
      email: `testthree_${Date.now()}@example.com`,
      phone: `9876_${Date.now()}_2`,
      city: 'Bangalore',
    }).returning();
    const c3 = customer3Result[0];

    console.log('Creating test segment and campaign...');
    const segmentResult = await db.insert(schema.segments).values({
      name: 'Test Analytics Segment',
      rulesJson: { type: 'condition', field: 'city', operator: '=', value: 'Mumbai' }
    }).returning();
    const segment = segmentResult[0];

    const campaignResult = await db.insert(schema.campaigns).values({
      segmentId: segment.id,
      name: 'Test Analytics Campaign',
      channel: 'WHATSAPP',
      messageTemplate: 'Hi {{firstName}}, check this out!',
      status: 'RUNNING',
      audienceSize: 2
    }).returning();
    const campaign = campaignResult[0];

    // 2. Add customers to campaign audience
    // c1 and c2 are in campaign audience, c3 is NOT.
    console.log('Populating campaign audience...');
    await db.insert(schema.campaignAudience).values([
      { campaignId: campaign.id, customerId: c1.id },
      { campaignId: campaign.id, customerId: c2.id },
    ]);

    // 3. Insert communication events
    // c1 receives DELIVERED event
    // c2 receives FAILED event (so no DELIVERED)
    console.log('Creating communication events...');
    const now = new Date();
    const deliveryTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

    // c1 events
    await db.insert(schema.communicationEvents).values([
      { campaignId: campaign.id, customerId: c1.id, eventType: 'SENT', timestamp: new Date(deliveryTime.getTime() - 2000) },
      { campaignId: campaign.id, customerId: c1.id, eventType: 'DELIVERED', timestamp: deliveryTime },
    ]);

    // c2 events
    await db.insert(schema.communicationEvents).values([
      { campaignId: campaign.id, customerId: c2.id, eventType: 'SENT', timestamp: new Date(deliveryTime.getTime() - 2000) },
      { campaignId: campaign.id, customerId: c2.id, eventType: 'FAILED', timestamp: deliveryTime },
    ]);

    // 4. Create orders
    console.log('Creating orders to test attribution rule...');
    
    // Order A: Customer c1, placed 1 day after delivery (within 7 days) -> SHOULD BE ATTRIBUTED
    // Amount: 1000.00
    const orderDateA = new Date(deliveryTime.getTime() + 24 * 60 * 60 * 1000);
    const orderARes = await db.insert(schema.orders).values({
      customerId: c1.id,
      amount: '1000.00',
      category: 'Electronics',
      orderDate: orderDateA
    }).returning();

    // Order B: Customer c1, placed 8 days after delivery (outside 7 days) -> SHOULD NOT BE ATTRIBUTED
    // Amount: 5000.00
    const orderDateB = new Date(deliveryTime.getTime() + 8 * 24 * 60 * 60 * 1000);
    const orderBRes = await db.insert(schema.orders).values({
      customerId: c1.id,
      amount: '5000.00',
      category: 'Apparel',
      orderDate: orderDateB
    }).returning();

    // Order C: Customer c2, placed 1 day after event but c2 received FAILED (no DELIVERED) -> SHOULD NOT BE ATTRIBUTED
    // Amount: 2000.00
    const orderDateC = new Date(deliveryTime.getTime() + 24 * 60 * 60 * 1000);
    const orderCRes = await db.insert(schema.orders).values({
      customerId: c2.id,
      amount: '2000.00',
      category: 'Electronics',
      orderDate: orderDateC
    }).returning();

    // Order D: Customer c3, placed 1 day after delivery, but c3 not in campaign audience -> SHOULD NOT BE ATTRIBUTED
    // Amount: 3000.00
    const orderDRes = await db.insert(schema.orders).values({
      customerId: c3.id,
      amount: '3000.00',
      category: 'Electronics',
      orderDate: orderDateC
    }).returning();

    // 5. Test getCampaignRevenue
    console.log('Testing getCampaignRevenue()...');
    const revenue = await getCampaignRevenue(campaign.id);
    console.log(`Retrieved Revenue: ${revenue} (Expected: 1000)`);
    if (revenue !== 1000) {
      throw new Error(`Expected campaign revenue to be 1000, but got ${revenue}`);
    }
    console.log('✅ getCampaignRevenue test passed.');

    // 6. Test getCampaignROI
    console.log('Testing getCampaignROI()...');
    const roi = await getCampaignROI(campaign.id);
    // Cost calculation details:
    // WHATSAPP cost = 0.50 INR. Sent count = 2 (c1 and c2).
    // Cost = 2 * 0.50 = 1.00 INR.
    // ROI = ((1000 - 1.00) / 1.00) * 100 = 99900%
    console.log(`Retrieved ROI: ${roi}% (Expected: 99900%)`);
    if (Math.abs(roi - 99900) > 0.01) {
      throw new Error(`Expected campaign ROI to be 99900%, but got ${roi}`);
    }
    console.log('✅ getCampaignROI test passed.');

    // 7. Test getCampaignAnalytics
    console.log('Testing getCampaignAnalytics()...');
    const analytics = await getCampaignAnalytics(campaign.id);
    console.log('Campaign Analytics payload:', JSON.stringify(analytics, null, 2));
    
    if (analytics.audienceSize !== 2) throw new Error(`Expected audienceSize 2, got ${analytics.audienceSize}`);
    if (analytics.sent !== 2) throw new Error(`Expected sent 2, got ${analytics.sent}`);
    if (analytics.delivered !== 1) throw new Error(`Expected delivered 1, got ${analytics.delivered}`);
    if (analytics.failed !== 1) throw new Error(`Expected failed 1, got ${analytics.failed}`);
    if (analytics.deliveryRate !== 50) throw new Error(`Expected deliveryRate 50%, got ${analytics.deliveryRate}%`);
    if (analytics.campaignRevenue !== 1000) throw new Error(`Expected campaignRevenue 1000, got ${analytics.campaignRevenue}`);
    if (analytics.campaignCost !== 1.00) throw new Error(`Expected campaignCost 1.00, got ${analytics.campaignCost}`);
    if (Math.abs(analytics.campaignRoi - 99900) > 0.01) throw new Error(`Expected campaignRoi 99900, got ${analytics.campaignRoi}`);
    console.log('✅ getCampaignAnalytics test passed.');

    // 8. Test getCampaignPerformanceSummary()
    console.log('Testing getCampaignPerformanceSummary()...');
    const summaries = await getCampaignPerformanceSummary();
    const ourCampaignSummary = summaries.find(s => s.id === campaign.id);
    if (!ourCampaignSummary) throw new Error('Could not find test campaign in performance summary');
    if (ourCampaignSummary.revenue !== 1000) throw new Error(`Expected summary revenue 1000, got ${ourCampaignSummary.revenue}`);
    console.log('✅ getCampaignPerformanceSummary test passed.');

    // 9. Test getCustomerAnalytics()
    console.log('Testing getCustomerAnalytics()...');
    const customerAnalytics = await getCustomerAnalytics();
    console.log(`Total customers: ${customerAnalytics.totalCustomers}`);
    if (customerAnalytics.totalCustomers < 3) throw new Error('Total customers count is too low');
    console.log('✅ getCustomerAnalytics test passed.');

    // 10. Test getChannelPerformance()
    console.log('Testing getChannelPerformance()...');
    const channelPerf = await getChannelPerformance();
    const whatsappPerf = channelPerf.find(p => p.channel === 'WHATSAPP');
    if (!whatsappPerf) throw new Error('Could not find WHATSAPP channel in performance splits');
    console.log('✅ getChannelPerformance test passed.');

    // 11. Test getDashboardMetrics()
    console.log('Testing getDashboardMetrics()...');
    const dashboardMetrics = await getDashboardMetrics();
    console.log('Dashboard metrics:', JSON.stringify(dashboardMetrics, null, 2));
    if (dashboardMetrics.totalRevenue <= 0) throw new Error('Total revenue should be greater than zero');
    if (dashboardMetrics.totalOrders <= 0) throw new Error('Total orders should be greater than zero');
    if (dashboardMetrics.totalCustomers < 3) throw new Error('Total customers should be at least 3');
    if (dashboardMetrics.totalCampaigns < 1) throw new Error('Total campaigns should be at least 1');
    console.log('✅ getDashboardMetrics test passed.');

    // 12. Clean up
    console.log('Cleaning up test records...');
    // Delete orders
    await db.delete(schema.orders).where(eq(schema.orders.id, orderARes[0].id));
    await db.delete(schema.orders).where(eq(schema.orders.id, orderBRes[0].id));
    await db.delete(schema.orders).where(eq(schema.orders.id, orderCRes[0].id));
    await db.delete(schema.orders).where(eq(schema.orders.id, orderDRes[0].id));
    // Delete events
    await db.delete(schema.communicationEvents).where(eq(schema.communicationEvents.campaignId, campaign.id));
    // Delete audience
    await db.delete(schema.campaignAudience).where(eq(schema.campaignAudience.campaignId, campaign.id));
    // Delete campaign
    await db.delete(schema.campaigns).where(eq(schema.campaigns.id, campaign.id));
    // Delete segment
    await db.delete(schema.segments).where(eq(schema.segments.id, segment.id));
    // Delete customers
    await db.delete(schema.customers).where(eq(schema.customers.id, c1.id));
    await db.delete(schema.customers).where(eq(schema.customers.id, c2.id));
    await db.delete(schema.customers).where(eq(schema.customers.id, c3.id));
    
    console.log('✅ Cleanup complete.');
    console.log('--- All Analytics Engine Integration Tests Passed Successfully ---');
    process.exit(0);

  } catch (error) {
    console.error('❌ Analytics Engine integration test failed:', error);
    process.exit(1);
  }
}

testAnalyticsFlow();
