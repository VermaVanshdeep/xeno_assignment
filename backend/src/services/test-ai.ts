import { validateSegmentRule, sanitizeSegmentRule, routeIntent, generateSegmentRules, generateCampaignContent, generateAnalyticsInsights, generateOptimizationSuggestions } from './aiService';
import { db } from '../db/index';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { createCampaign, launchCampaign } from './campaignService';

async function runLocalTests() {
  console.log('--- Running Local AI Service Helper Unit Tests ---');

  // Test 1: Valid Condition Rule
  const validCondition = {
    type: 'condition',
    field: 'totalSpend',
    operator: '>',
    value: 5000
  };
  console.log('Test 1: Valid condition validation:', validateSegmentRule(validCondition) ? '✅ PASSED' : '❌ FAILED');

  // Test 2: Invalid Field Rule
  const invalidField = {
    type: 'condition',
    field: 'invalid_field_name',
    operator: '>',
    value: 5000
  };
  console.log('Test 2: Invalid field validation (expected false):', !validateSegmentRule(invalidField) ? '✅ PASSED' : '❌ FAILED');

  // Test 3: Invalid Operator Rule
  const invalidOperator = {
    type: 'condition',
    field: 'totalSpend',
    operator: 'INVALID_OP',
    value: 5000
  };
  console.log('Test 3: Invalid operator validation (expected false):', !validateSegmentRule(invalidOperator) ? '✅ PASSED' : '❌ FAILED');

  // Test 4: Valid Nested Group Rule
  const validGroup = {
    type: 'group',
    logic: 'AND',
    children: [
      { type: 'condition', field: 'city', operator: '=', value: 'Mumbai' },
      { type: 'condition', field: 'totalOrders', operator: '>', value: '5' }
    ]
  };
  console.log('Test 4: Valid nested group validation:', validateSegmentRule(validGroup) ? '✅ PASSED' : '❌ FAILED');

  // Test 5: Sanitization of string numbers
  const sanitized = sanitizeSegmentRule(validGroup);
  const secondChildValue = (sanitized as any).children[1].value;
  console.log('Test 5: String conversion sanitization (expected number 5):', typeof secondChildValue === 'number' && secondChildValue === 5 ? '✅ PASSED' : '❌ FAILED');
  
  console.log('--- Local AI Helper Tests Completed ---\n');
}

async function runLiveTests() {
  console.log('--- Starting Live AI Copilot Groq Integration Tests ---');

  if (!process.env.GROQ_API_KEY) {
    console.log('⚠️ GROQ_API_KEY is not set. Skipping live Groq API integration tests.');
    return;
  }

  try {
    // 1. Test Intent Router
    console.log('Testing routeIntent()...');
    const segmentIntent = await routeIntent('Find customers who spent more than 5000 and live in Mumbai');
    console.log(`- Classification for Segment query: ${segmentIntent} (Expected: SEGMENT_GENERATION)`);
    if (segmentIntent !== 'SEGMENT_GENERATION') throw new Error('Failed to classify segment query intent');

    const campaignIntent = await routeIntent('Draft a promotion WhatsApp message offering 15% discount');
    console.log(`- Classification for Campaign query: ${campaignIntent} (Expected: CAMPAIGN_GENERATION)`);
    if (campaignIntent !== 'CAMPAIGN_GENERATION') throw new Error('Failed to classify campaign query intent');

    const analyticsIntent = await routeIntent('Why did campaign XYZ do better than ABC?');
    console.log(`- Classification for Analytics query: ${analyticsIntent} (Expected: ANALYTICS_INSIGHT)`);
    if (analyticsIntent !== 'ANALYTICS_INSIGHT') throw new Error('Failed to classify analytics query intent');

    const optIntent = await routeIntent('How can I optimize the click through rate of WhatsApp messages?');
    console.log(`- Classification for Optimization query: ${optIntent} (Expected: OPTIMIZATION_SUGGESTION)`);
    if (optIntent !== 'OPTIMIZATION_SUGGESTION') throw new Error('Failed to classify optimization query intent');

    console.log('✅ routeIntent tests passed.');

    // 2. Test Segment AST Generation
    console.log('Testing generateSegmentRules()...');
    const segmentAst = await generateSegmentRules('Find customers who spent more than 5000 and have not purchased in 60 days');
    console.log('Generated AST Rule:', JSON.stringify(segmentAst, null, 2));
    if (!validateSegmentRule(segmentAst)) throw new Error('Generated AST is invalid');
    console.log('✅ generateSegmentRules tests passed.');

    // 3. Test Campaign Content Generation
    console.log('Testing generateCampaignContent()...');
    const campaignContent = await generateCampaignContent('Create a WhatsApp re-engagement campaign offering free shipping on electronics');
    console.log('Generated Campaign content:', JSON.stringify(campaignContent, null, 2));
    if (!campaignContent.campaignTitle || !campaignContent.messageContent || campaignContent.recommendedChannel !== 'WHATSAPP') {
      throw new Error('Generated Campaign content does not match template inputs');
    }
    console.log('✅ generateCampaignContent tests passed.');

    // 4. Test Analytics Insights & Optimization Suggestions
    // To run live DB queries, check if DATABASE_URL is set
    if (process.env.DATABASE_URL) {
      console.log('Testing generateAnalyticsInsights() and generateOptimizationSuggestions()...');
      
      // Select an existing campaign or mock one
      const campaigns = await db.select().from(schema.campaigns).limit(1);
      if (campaigns.length > 0) {
        const campaignId = campaigns[0].id;
        const insights = await generateAnalyticsInsights(campaignId);
        console.log('Generated Analytics insights:', JSON.stringify(insights, null, 2));
        if (!insights.insights) throw new Error('Failed to generate insights content');
      } else {
        console.log('⚠️ No campaigns found in database to run analytics insights tests. Skipping campaign-specific insights.');
      }

      const suggestions = await generateOptimizationSuggestions('WHATSAPP');
      console.log('Generated Optimization suggestions:', JSON.stringify(suggestions, null, 2));
      if (!suggestions.suggestions || suggestions.suggestions.length === 0) {
        throw new Error('Failed to generate optimization suggestions array');
      }
      console.log('✅ generateOptimizationSuggestions tests passed.');
    } else {
      console.log('⚠️ DATABASE_URL not set. Skipping DB-dependent insights and suggestions tests.');
    }

    console.log('--- All Live AI Copilot Groq Tests Passed Successfully ---');

  } catch (error) {
    console.error('❌ Live AI Copilot Groq test failed:', error);
    process.exit(1);
  }
}

async function testAll() {
  await runLocalTests();
  await runLiveTests();
  process.exit(0);
}

testAll();
