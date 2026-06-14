import Groq from 'groq-sdk';
import { SegmentRule, RuleField, RuleOperator } from '../types/segment';
import { getCampaignAnalytics, getChannelPerformance } from './analyticsService';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) {
  throw new Error('Missing GROQ_API_KEY');
}

const groq = new Groq({
  apiKey: groqApiKey,
});

const MODEL = 'llama-3.3-70b-versatile';

// Allowed fields and operators for Segment AST Validation
const ALLOWED_FIELDS: RuleField[] = ['totalSpend', 'totalOrders', 'city', 'categoryPurchased', 'daysSinceLastPurchase'];
const ALLOWED_OPERATORS: RuleOperator[] = ['>', '<', '=', '!=', 'contains'];

/**
 * Validates a generated segment rule structure recursively.
 */
export function validateSegmentRule(rule: any): rule is SegmentRule {
  if (!rule || typeof rule !== 'object') {
    return false;
  }

  if (rule.type === 'condition') {
    const { field, operator, value } = rule;
    if (!ALLOWED_FIELDS.includes(field)) {
      return false;
    }
    if (!ALLOWED_OPERATORS.includes(operator)) {
      return false;
    }
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      return false;
    }
    // Specific validation: numeric fields must be castable to numbers
    if (['totalSpend', 'totalOrders', 'daysSinceLastPurchase'].includes(field)) {
      if (typeof value === 'string' && isNaN(Number(value))) {
        return false;
      }
    }
    return true;
  } else if (rule.type === 'group') {
    const { logic, children } = rule;
    if (logic !== 'AND' && logic !== 'OR') {
      return false;
    }
    if (!Array.isArray(children)) {
      return false;
    }
    for (const child of children) {
      if (!validateSegmentRule(child)) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Recursively cleans and sanitizes types of the segment rule.
 * Converts numeric string values to number types where appropriate.
 */
export function sanitizeSegmentRule(rule: any): SegmentRule {
  if (rule.type === 'condition') {
    let value = rule.value;
    if (['totalSpend', 'totalOrders', 'daysSinceLastPurchase'].includes(rule.field)) {
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (!isNaN(parsed)) {
          value = parsed;
        }
      }
    }
    return {
      type: 'condition',
      field: rule.field as RuleField,
      operator: rule.operator as RuleOperator,
      value
    };
  } else if (rule.type === 'group') {
    return {
      type: 'group',
      logic: rule.logic,
      children: rule.children.map((child: any) => sanitizeSegmentRule(child))
    };
  }
  throw new Error('Invalid segment rule structure');
}

/**
 * Helper to call Groq API and parse JSON safely
 */
async function callGroqJson(systemPrompt: string, userPrompt: string): Promise<any> {
  const fullSystemPrompt = systemPrompt + "\n\nReturn ONLY valid JSON.\nNo markdown.\nNo explanations.\nNo code fences.";
  const response = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: fullSystemPrompt },
      { role: 'user', content: userPrompt }
    ],
    model: MODEL,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error("Invalid AI JSON response");
  }
}

export type AIIntent =
  | 'GREETING'
  | 'GENERAL_CHAT'
  | 'SEGMENT_GENERATION'
  | 'CAMPAIGN_GENERATION'
  | 'ANALYTICS_INSIGHT'
  | 'OPTIMIZATION_SUGGESTION';

// Fast local pre-classifier — avoids unnecessary LLM calls for obvious cases.
const GREETING_WORDS = new Set([
  'hi', 'hello', 'hey', 'sup', 'yo', 'howdy', 'greetings',
  'good morning', 'good afternoon', 'good evening', 'good night',
  'hiya', 'namaste', 'salut'
]);

const GENERAL_CHAT_PATTERNS = [
  /^who are you/i, /^what (can|do) you/i, /^help$/i, /^help me/i,
  /^what is (a )?crm/i, /^explain/i, /^tell me about/i,
  /^(how|what) (does|is) (this|xeno)/i
];

function localPreClassify(prompt: string): AIIntent | null {
  const lower = prompt.toLowerCase().trim();

  // Single-word or short greetings
  if (GREETING_WORDS.has(lower)) return 'GREETING';

  // Multi-word greetings (e.g. "good morning")
  for (const g of GREETING_WORDS) {
    if (lower === g || lower.startsWith(g + ' ') || lower.endsWith(' ' + g)) {
      if (lower.length < 30) return 'GREETING';
    }
  }

  // General chat patterns
  for (const pattern of GENERAL_CHAT_PATTERNS) {
    if (pattern.test(lower)) return 'GENERAL_CHAT';
  }

  return null; // fall through to LLM
}

/**
 * Classifies a user query into one of the six supported Copilot intent categories.
 * Uses a fast local pre-classifier first, then falls back to the LLM for ambiguous inputs.
 */
export async function routeIntent(prompt: string): Promise<AIIntent> {
  // 1. Local pre-classifier (zero latency, no API call needed)
  const localResult = localPreClassify(prompt);
  if (localResult) return localResult;

  // 2. LLM classifier for ambiguous inputs
  const systemInstruction = `
You are an intent router for a marketing CRM AI assistant.
Analyze the user prompt and classify it STRICTLY into exactly one of these 6 categories:

- GREETING: Short social openers. Examples: "hi", "hello", "hey", "good morning", "hi there".
- GENERAL_CHAT: General questions about the system, assistant identity, or CRM concepts. Examples: "who are you", "what can you do", "help", "explain CRM", "what is this tool".
- SEGMENT_GENERATION: Queries to filter, find, or select customer audiences. Examples: "customers in Mumbai who spent > 5000", "inactive users last 30 days", "find coffee buyers", "show high-value customers".
- CAMPAIGN_GENERATION: Requests to create, draft, or generate campaign content or messages. Examples: "create a WhatsApp promo", "write a re-engagement SMS", "generate a campaign for inactive users".
- ANALYTICS_INSIGHT: Questions about campaign performance, metrics, or comparisons. Examples: "analyze campaign ROI", "why did CTR drop", "explain delivery rate", "compare campaigns".
- OPTIMIZATION_SUGGESTION: Requests for improvement tips or recommendations. Examples: "how to improve CTR", "optimize open rate", "better WhatsApp engagement".

CRITICAL RULES:
- Single words like "hi", "hello", "hey" are ALWAYS GREETING — never SEGMENT_GENERATION.
- Short greetings (< 4 words) that don't mention customers, segments, campaigns, metrics, or channels MUST be GREETING or GENERAL_CHAT.
- Only use SEGMENT_GENERATION if the prompt explicitly references customers, users, spend amounts, cities, or purchase behavior.
- When uncertain between GREETING and SEGMENT_GENERATION, always choose GREETING for short inputs.

Return ONLY this JSON:
{ "intent": "<ONE_OF_THE_SIX_CATEGORIES>", "confidence": <0-100> }
`;

  const result = await callGroqJson(systemInstruction, `Classify this prompt: "${prompt}"`);

  const VALID_INTENTS: AIIntent[] = [
    'GREETING', 'GENERAL_CHAT',
    'SEGMENT_GENERATION', 'CAMPAIGN_GENERATION',
    'ANALYTICS_INSIGHT', 'OPTIMIZATION_SUGGESTION'
  ];

  if (!VALID_INTENTS.includes(result.intent)) {
    // Fallback: short inputs with low confidence default to GREETING
    if (prompt.trim().split(/\s+/).length <= 3) return 'GREETING';
    return 'GENERAL_CHAT';
  }

  // If confidence is below 70% and input is short, prefer GREETING/GENERAL_CHAT
  const confidence = typeof result.confidence === 'number' ? result.confidence : 100;
  if (confidence < 70 && prompt.trim().split(/\s+/).length <= 4) {
    if (!['SEGMENT_GENERATION', 'CAMPAIGN_GENERATION', 'ANALYTICS_INSIGHT', 'OPTIMIZATION_SUGGESTION']
        .some(i => prompt.toLowerCase().includes(i.split('_')[0].toLowerCase()))) {
      return 'GENERAL_CHAT';
    }
  }

  return result.intent as AIIntent;
}

/**
 * Generates a logic rule AST for segment filters.
 */
export async function generateSegmentRules(prompt: string): Promise<SegmentRule> {
  const systemInstruction = `
You are a translation assistant that converts a natural language customer segmentation request into a structured JSON Segment AST.
The AST format is defined by the SegmentRule TypeScript interface.

TypeScript types:
type LogicalOperator = 'AND' | 'OR';
type RuleOperator = '>' | '<' | '=' | '!=' | 'contains';
type RuleField = 'totalSpend' | 'totalOrders' | 'city' | 'categoryPurchased' | 'daysSinceLastPurchase';

interface ConditionRule {
  type: 'condition';
  field: RuleField;
  operator: RuleOperator;
  value: string | number;
}

interface GroupRule {
  type: 'group';
  logic: LogicalOperator;
  children: SegmentRule[];
}

type SegmentRule = ConditionRule | GroupRule;

Important Rules:
1. Always output a single JSON object matching either a ConditionRule or GroupRule.
2. The field MUST be exactly one of the RuleField strings.
3. The operator MUST be exactly one of the RuleOperator strings.
4. If checking if a customer purchased a category, use field 'categoryPurchased' and operator 'contains' or '='.
5. If checking if a customer spent more/less money, use field 'totalSpend' and operator '>' or '<' or '='.
6. If checking days since last purchase, use field 'daysSinceLastPurchase'.
7. Do not include extra properties. No comments, markdown, or explainers. Just the raw JSON object.
`;

  const rawAst = await callGroqJson(systemInstruction, `Translate this query to a Segment AST JSON: "${prompt}"`);

  if (!validateSegmentRule(rawAst)) {
    throw new Error('AI generated an invalid segment rule AST');
  }

  return sanitizeSegmentRule(rawAst);
}

export interface CampaignContent {
  campaignTitle: string;
  campaignObjective: string;
  messageContent: string;
  recommendedChannel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'RCS';
}

/**
 * Generates campaign templates, objective, and recommends channels.
 */
export async function generateCampaignContent(prompt: string): Promise<CampaignContent> {
  const systemInstruction = `
You are a campaign content writer. Generate creative campaign content from user intent.
Your response MUST be a structured JSON object with the following fields:
- campaignTitle: A short, catchy title for the campaign.
- campaignObjective: The goal or objective of the campaign.
- messageContent: The actual body content of the message. Templates should support template variables like {{firstName}} if necessary.
- recommendedChannel: Recommend exactly one channel: 'WHATSAPP', 'SMS', 'EMAIL', or 'RCS'.
`;

  const result = await callGroqJson(systemInstruction, `Generate a campaign content based on the following instruction: "${prompt}"`);
  
  // Basic structural validation
  if (!result.campaignTitle || !result.campaignObjective || !result.messageContent || !result.recommendedChannel) {
    throw new Error("Invalid AI JSON response: missing required campaign fields");
  }

  return result as CampaignContent;
}

export interface AnalyticsInsights {
  insights: string;
  comparisonSummary?: string;
}

/**
 * Generates textual analysis insights for one or two campaign metric sets.
 */
export async function generateAnalyticsInsights(campaignIdA: string, campaignIdB?: string): Promise<AnalyticsInsights> {
  const analyticsA = await getCampaignAnalytics(campaignIdA);
  let metricsText = `Campaign A Analytics (ID: ${campaignIdA}):\n${JSON.stringify(analyticsA, null, 2)}`;

  if (campaignIdB) {
    const analyticsB = await getCampaignAnalytics(campaignIdB);
    metricsText += `\n\nCampaign B Analytics (ID: ${campaignIdB}):\n${JSON.stringify(analyticsB, null, 2)}`;
  }

  const systemInstruction = `
You are a marketing analyst. Analyze the campaign metric summaries and explain campaign performance.
Provide detailed reasons on why the campaign performed the way it did, comparing rates (Open, Click, Delivery) and ROI.
Your output MUST be a structured JSON object with the following fields:
- insights: Your detailed reasoning explaining campaign performance.
- comparisonSummary: A concise comparison of campaign performance, emphasizing key differentiators (optional, only write if multiple campaigns are compared).
`;

  const userPrompt = campaignIdB
    ? `Compare Campaign A and Campaign B using these metrics:\n${metricsText}`
    : `Analyze this campaign's metrics and explain its performance:\n${metricsText}`;

  const result = await callGroqJson(systemInstruction, userPrompt);
  
  if (!result.insights) {
    throw new Error("Invalid AI JSON response: missing insights field");
  }
  return result as AnalyticsInsights;
}

export interface OptimizationSuggestions {
  suggestions: string[];
  reasoning: string;
}

/**
 * Analyzes overall channel metrics and returns performance recommendations.
 */
export async function generateOptimizationSuggestions(channel: string): Promise<OptimizationSuggestions> {
  const performance = await getChannelPerformance();
  const channelData = performance.find(p => p.channel.toUpperCase() === channel.toUpperCase());

  let performanceContext = `All Channels Performance:\n${JSON.stringify(performance, null, 2)}`;
  if (channelData) {
    performanceContext += `\n\nTarget Channel data for ${channel}:\n${JSON.stringify(channelData, null, 2)}`;
  }

  const systemInstruction = `
You are a CRM marketer optimizer. Based on the channel performance metrics provided, generate concrete, actionable marketing optimization recommendations for the target channel.
Explain how they can improve key metrics such as Click-Through Rate (CTR), Read Rate, or Delivery rate.
Your output MUST be a structured JSON object with the following fields:
- suggestions: An array of strings representing concrete suggestions.
- reasoning: Explanation of why these suggestions are proposed based on current performance data.
`;

  const result = await callGroqJson(systemInstruction, `Provide optimization recommendations for the channel '${channel}' using these performance metrics:\n${performanceContext}`);
  
  if (!Array.isArray(result.suggestions) || !result.reasoning) {
    throw new Error("Invalid AI JSON response: missing suggestions or reasoning");
  }
  return result as OptimizationSuggestions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Segment Enrichment — marketer-friendly metadata for segment cards
// ─────────────────────────────────────────────────────────────────────────────

export interface SegmentEnrichment {
  segmentTitle: string;          // Short, punchy name (e.g. "High-Value Mumbai Customers")
  audienceSummary: string;       // One-line summary (e.g. "368 customers match your criteria")
  audienceRationale: string;     // Why this audience matters for marketing
  recommendedChannel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'RCS';
  recommendedCampaign: string;   // E.g. "Premium Loyalty Offer" or "Re-engagement Discount"
}

/**
 * Generates marketer-friendly enrichment metadata for a customer segment.
 * Takes the original user prompt, the human-readable conditions, and the live audience count.
 */
export async function generateSegmentEnrichment(
  prompt: string,
  conditionsSummary: string,
  audienceCount: number
): Promise<SegmentEnrichment> {
  const systemInstruction = `
You are an expert CRM marketing strategist.
Given a customer segment query, the segment conditions, and the live audience count, generate marketer-friendly enrichment data.

Output MUST be a JSON object with EXACTLY these fields:
- segmentTitle: A short, punchy, title-case name for this customer segment (max 6 words). Example: "High-Value Mumbai Customers"
- audienceSummary: A single friendly sentence describing the audience. Example: "368 customers match your criteria — a strong, targetable cohort."
- audienceRationale: 1-2 sentences explaining why this audience is valuable for marketing campaigns. Example: "These customers show high purchase intent and above-average spending, making them ideal for premium offers and loyalty programs."
- recommendedChannel: The single best channel to reach this audience. Must be exactly one of: "WHATSAPP", "SMS", "EMAIL", "RCS".
- recommendedCampaign: A short, specific campaign idea (max 6 words). Example: "Premium Loyalty Reward Offer"

Rules:
- Do NOT include JSON syntax, markdown, or code fences.
- Keep language conversational and marketer-friendly — no technical jargon.
- segmentTitle must be professional and descriptive.
- audienceRationale must explain business value, not technical details.
`;

  const userPrompt = `
Original request: "${prompt}"
Segment conditions: ${conditionsSummary}
Live audience count: ${audienceCount} customers

Generate the segment enrichment metadata.`;

  const result = await callGroqJson(systemInstruction, userPrompt);

  // Validate required fields
  if (!result.segmentTitle || !result.audienceSummary || !result.audienceRationale || !result.recommendedChannel || !result.recommendedCampaign) {
    // Fallback with sensible defaults if AI gives incomplete response
    return {
      segmentTitle: 'Custom Customer Segment',
      audienceSummary: `${audienceCount.toLocaleString()} customers match your criteria.`,
      audienceRationale: 'This audience is ready for targeted campaigns based on their purchase behaviour.',
      recommendedChannel: 'WHATSAPP',
      recommendedCampaign: 'Targeted Engagement Campaign',
    };
  }

  // Normalise channel value
  const validChannels = ['WHATSAPP', 'SMS', 'EMAIL', 'RCS'] as const;
  const channel = validChannels.includes(result.recommendedChannel?.toUpperCase())
    ? result.recommendedChannel.toUpperCase() as SegmentEnrichment['recommendedChannel']
    : 'WHATSAPP';

  return { ...result, recommendedChannel: channel } as SegmentEnrichment;
}
