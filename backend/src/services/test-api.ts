import app from '../index';
import { Server } from 'http';
import { db } from '../db/index';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

let server: Server;
let baseUrl: string;

function startServer(): Promise<string> {
  return new Promise((resolve) => {
    // Set NODE_ENV to test to prevent standard app.listen
    process.env.NODE_ENV = 'test';
    server = app.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        baseUrl = `http://localhost:${address.port}`;
        resolve(baseUrl);
      }
    });
  });
}



function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function runTests() {
  console.log('--- Starting Express REST API Integration Tests ---');
  const url = await startServer();
  console.log(`Test server booted at: ${url}`);

  try {
    // ==========================================
    // 1. Static Offline and Validation Tests (Always Run)
    // ==========================================
    console.log('\nRunning Offline Routing & Validation Tests...');

    // Test 1: Healthcheck
    const healthRes = await fetch(`${url}/api/health`);
    const healthData = await healthRes.json();
    console.log(`Test 1: Healthcheck (Expected 200 ok):`, healthRes.status === 200 && healthData.status === 'ok' ? '✅ PASSED' : '❌ FAILED');

    // Test 2: Unknown Route
    const unknownRes = await fetch(`${url}/api/unknown-non-existent-route`);
    const unknownData = await unknownRes.json();
    console.log(`Test 2: Unknown route (Expected 404):`, unknownRes.status === 404 && !unknownData.success ? '✅ PASSED' : '❌ FAILED');

    // Test 3: Segment Preview missing body
    const previewBadRes = await fetch(`${url}/api/segments/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    console.log(`Test 3: Preview rules validation (Expected 400):`, previewBadRes.status === 400 ? '✅ PASSED' : '❌ FAILED');

    // Test 4: Segment Preview invalid AST structure
    const previewInvalidRes = await fetch(`${url}/api/segments/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: { type: 'condition', field: 'invalidField', operator: '=', value: 'Delhi' } })
    });
    console.log(`Test 4: Preview invalid AST structure (Expected 400):`, previewInvalidRes.status === 400 ? '✅ PASSED' : '❌ FAILED');

    // Test 5: Create Campaign validation check
    const campaignBadRes = await fetch(`${url}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Promo' })
    });
    console.log(`Test 5: Campaign creation parameters validation (Expected 400):`, campaignBadRes.status === 400 ? '✅ PASSED' : '❌ FAILED');

    // ==========================================
    // 2. Database Integration Tests (Requires DATABASE_URL)
    // ==========================================
    if (process.env.DATABASE_URL) {
      console.log('\nRunning Database API Integration Tests...');

      // Setup a temp customer for segment targets
      const customerRes = await db.insert(schema.customers).values({
        firstName: 'ApiFirst',
        lastName: 'ApiLast',
        email: `apitest_${Date.now()}@example.com`,
        phone: `api_${Date.now()}`,
        city: 'Mumbai'
      }).returning();
      const customer = customerRes[0];

      // Test 6: Create Segment
      const rules = { type: 'condition', field: 'city', operator: '=', value: 'Mumbai' };
      const createSegmentRes = await fetch(`${url}/api/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Api Segment Mumbai', rules })
      });
      const segment = await createSegmentRes.json();
      console.log(`Test 6: Create segment (Expected 201):`, createSegmentRes.status === 201 && segment.id ? '✅ PASSED' : '❌ FAILED');

      // Test 7: List Segments
      const listSegmentsRes = await fetch(`${url}/api/segments`);
      const segments = await listSegmentsRes.json();
      console.log(`Test 7: List segments (Expected 200 Array):`, listSegmentsRes.status === 200 && Array.isArray(segments) ? '✅ PASSED' : '❌ FAILED');

      // Test 8: Get Segment
      const getSegmentRes = await fetch(`${url}/api/segments/${segment.id}`);
      const fetchedSegment = await getSegmentRes.json();
      console.log(`Test 8: Get single segment details (Expected 200):`, getSegmentRes.status === 200 && fetchedSegment.id === segment.id ? '✅ PASSED' : '❌ FAILED');

      // Test 9: Preview segment
      const previewRes = await fetch(`${url}/api/segments/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules })
      });
      const previewData = await previewRes.json();
      console.log(`Test 9: Preview segment counts (Expected 200 with count/preview):`, previewRes.status === 200 && typeof previewData.count === 'number' && Array.isArray(previewData.preview) ? '✅ PASSED' : '❌ FAILED');

      // Test 10: Create Campaign
      const createCampaignRes = await fetch(`${url}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentId: segment.id,
          name: 'Api Promo WhatsApp',
          channel: 'WHATSAPP',
          messageTemplate: 'Hi {{firstName}}!'
        })
      });
      const campaign = await createCampaignRes.json();
      console.log(`Test 10: Create Campaign (Expected 201):`, createCampaignRes.status === 201 && campaign.id ? '✅ PASSED' : '❌ FAILED');

      // Test 11: Launch Campaign
      const launchRes = await fetch(`${url}/api/campaigns/${campaign.id}/launch`, { method: 'POST' });
      const launchResult = await launchRes.json();
      console.log(`Test 11: Launch Campaign (Expected 200 and RUNNING):`, launchRes.status === 200 && launchResult.status === 'RUNNING' ? '✅ PASSED' : '❌ FAILED');

      // Test 12: Cancel Campaign
      const cancelRes = await fetch(`${url}/api/campaigns/${campaign.id}/cancel`, { method: 'POST' });
      const cancelResult = await cancelRes.json();
      console.log(`Test 12: Cancel Campaign (Expected 200 and CANCELLED):`, cancelRes.status === 200 && cancelResult.status === 'CANCELLED' ? '✅ PASSED' : '❌ FAILED');

      // Test 13: Analytics Dashboard
      const dashboardRes = await fetch(`${url}/api/analytics/dashboard`);
      const dashboard = await dashboardRes.json();
      console.log(`Test 13: Fetch Dashboard Metrics (Expected 200):`, dashboardRes.status === 200 && 'totalRevenue' in dashboard ? '✅ PASSED' : '❌ FAILED');

      // Test 14: Fetch Campaign Analytics
      const campAnalyticsRes = await fetch(`${url}/api/analytics/campaigns/${campaign.id}`);
      const campAnalytics = await campAnalyticsRes.json();
      console.log(`Test 14: Campaign Analytics (Expected 200):`, campAnalyticsRes.status === 200 && campAnalytics.campaignId === campaign.id ? '✅ PASSED' : '❌ FAILED');

      // Test 14b: Fetch Revenue Trend
      const revTrendRes = await fetch(`${url}/api/analytics/revenue-trend`);
      const revTrend = await revTrendRes.json();
      console.log(`Test 14b: Fetch Revenue Trend (Expected 200 Array):`, revTrendRes.status === 200 && Array.isArray(revTrend) ? '✅ PASSED' : '❌ FAILED');

      // Test 14c: Fetch Campaigns Summary
      const campSummaryRes = await fetch(`${url}/api/analytics/campaigns-summary`);
      const campSummary = await campSummaryRes.json();
      console.log(`Test 14c: Fetch Campaigns Summary (Expected 200 Array):`, campSummaryRes.status === 200 && Array.isArray(campSummary) ? '✅ PASSED' : '❌ FAILED');

      // Cleanup db records
      console.log('Cleaning up test records from database...');
      await db.delete(schema.communicationJobs).where(eq(schema.communicationJobs.campaignId, campaign.id));
      await db.delete(schema.campaignAudience).where(eq(schema.campaignAudience.campaignId, campaign.id));
      await db.delete(schema.campaigns).where(eq(schema.campaigns.id, campaign.id));
      await db.delete(schema.segments).where(eq(schema.segments.id, segment.id));
      await db.delete(schema.customers).where(eq(schema.customers.id, customer.id));
      console.log('Database cleanup completed.');
    } else {
      console.log('\n⚠️ DATABASE_URL is not set. Skipping Database API integration tests.');
    }

    // ==========================================
    // 3. AI Copilot Integration Tests (Requires GROQ_API_KEY)
    // ==========================================
    if (process.env.GROQ_API_KEY) {
      console.log('\nRunning AI Copilot API Integration Tests...');

      // Test 15: AI Intent classification routing
      const aiRouteRes = await fetch(`${url}/api/ai/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Find customers who spent more than 5000' })
      });
      const routeData = await aiRouteRes.json();
      console.log(`Test 15: AI Intent Routing (Expected SEGMENT_GENERATION):`, aiRouteRes.status === 200 && routeData.intent === 'SEGMENT_GENERATION' ? '✅ PASSED' : '❌ FAILED');

      // Test 16: AI Segment AST generation
      const aiSegmentRes = await fetch(`${url}/api/ai/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Find customers in Mumbai who spent more than 10000' })
      });
      const segmentRules = await aiSegmentRes.json();
      console.log(`Test 16: AI Segment AST generation (Expected valid group rule):`, aiSegmentRes.status === 200 && segmentRules.type === 'group' ? '✅ PASSED' : '❌ FAILED');

      // Test 17: AI Campaign Content generation
      const aiCampaignRes = await fetch(`${url}/api/ai/campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'WhatsApp campaign offering 10% discount to re-engage coffee segment' })
      });
      const campaignData = await aiCampaignRes.json();
      console.log(`Test 17: AI Campaign Content generation (Expected WHATSAPP content):`, aiCampaignRes.status === 200 && campaignData.recommendedChannel === 'WHATSAPP' ? '✅ PASSED' : '❌ FAILED');
    } else {
      console.log('\n⚠️ GROQ_API_KEY is not set. Skipping AI Copilot API integration tests.');
    }

    console.log('\n--- All API Integration Tests Completed Successfully ---');
    await stopServer();
    process.exit(0);

  } catch (error) {
    console.error('❌ REST API integration tests failed:', error);
    await stopServer();
    process.exit(1);
  }
}

runTests();
