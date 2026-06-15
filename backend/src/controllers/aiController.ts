import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { 
  routeIntent as routeIntentService,
  generateSegmentRules as generateSegmentRulesService, 
  generateCampaignContent as generateCampaignContentService, 
  regenerateCampaignField as regenerateCampaignFieldService,
  generatePostLaunchInsights as generatePostLaunchInsightsService,
  generateAudienceRationale as generateAudienceRationaleService,
  generateAnalyticsInsights as generateAnalyticsInsightsService, 
  generateOptimizationSuggestions as generateOptimizationSuggestionsService,
  generateSegmentEnrichment as generateSegmentEnrichmentService
} from '../services/aiService';

export async function routeIntent(req: Request, res: Response, next: NextFunction) {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'prompt is required' });
    }
    const intent = await routeIntentService(prompt);
    res.json({ intent });
  } catch (error) {
    next(error);
  }
}

export async function generateSegmentRules(req: Request, res: Response, next: NextFunction) {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'prompt is required' });
    }
    const rules = await generateSegmentRulesService(prompt);
    res.json(rules);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/ai/campaign
 * Legacy: accepts a string prompt (from AI Copilot chat)
 */
export async function generateCampaignContent(req: Request, res: Response, next: NextFunction) {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'prompt is required' });
    }
    const content = await generateCampaignContentService(prompt);
    res.json(content);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/ai/campaign/draft
 * New: generates a full campaign draft from segment context, channel, and goal.
 * Also fetches campaign history to avoid repeating names.
 */
export async function generateCampaignDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const { segmentName, segmentSize, channel, goal } = req.body;

    if (!segmentName || !channel || !goal) {
      return res.status(400).json({ 
        success: false, 
        message: 'segmentName, channel, and goal are required' 
      });
    }

    // Fetch campaign history to avoid repeating names
    const history = await db
      .select({ name: schema.campaigns.name, channel: schema.campaigns.channel, status: schema.campaigns.status })
      .from(schema.campaigns)
      .orderBy(schema.campaigns.createdAt)
      .limit(20);

    const content = await generateCampaignContentService({
      segmentName,
      segmentSize: typeof segmentSize === 'number' ? segmentSize : 0,
      channel,
      goal,
      campaignHistory: history,
    });

    res.json(content);
  } catch (error: any) {
    // Surface the Groq error with a retry-friendly message — no silent fallbacks
    res.status(502).json({
      success: false,
      message: error.message || 'AI generation failed. Please retry.',
      retryable: true,
    });
  }
}

/**
 * POST /api/ai/campaign/regenerate-field
 * Regenerates a single field of an existing campaign draft.
 */
export async function regenerateCampaignField(req: Request, res: Response, next: NextFunction) {
  try {
    const { field, currentDraft, segmentName, segmentSize, channel, goal } = req.body;

    const validFields = ['campaignName', 'objective', 'messageCopy', 'ctaText'];
    if (!field || !validFields.includes(field)) {
      return res.status(400).json({ 
        success: false, 
        message: `field must be one of: ${validFields.join(', ')}` 
      });
    }
    if (!segmentName || !channel || !goal) {
      return res.status(400).json({ 
        success: false, 
        message: 'segmentName, channel, and goal are required' 
      });
    }

    const result = await regenerateCampaignFieldService({
      field,
      currentDraft: currentDraft || {},
      segmentName,
      segmentSize: typeof segmentSize === 'number' ? segmentSize : 0,
      channel,
      goal,
    });

    res.json(result);
  } catch (error: any) {
    res.status(502).json({
      success: false,
      message: error.message || 'Field regeneration failed. Please retry.',
      retryable: true,
    });
  }
}

/**
 * POST /api/ai/campaign/post-launch-insights
 * Generates and stores post-launch AI insights snapshot for a completed campaign.
 */
export async function getCampaignPostLaunchInsights(req: Request, res: Response, next: NextFunction) {
  try {
    const { campaignId } = req.body;
    if (!campaignId) {
      return res.status(400).json({ success: false, message: 'campaignId is required' });
    }

    // Check for existing cached snapshot
    const campaignRecord = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);

    if (campaignRecord.length === 0) {
      return res.status(404).json({ success: false, message: `Campaign ${campaignId} not found` });
    }

    const existing = campaignRecord[0].metadataJson as any;
    const { forceRefresh } = req.body;

    // Return cached snapshot if exists and not requesting refresh
    if (!forceRefresh && existing?.performanceSummary && existing?.insightsGeneratedAt) {
      return res.json({
        ...existing,
        cached: true,
        insightsGeneratedAt: existing.insightsGeneratedAt,
      });
    }

    // Generate fresh insights from real analytics
    const insights = await generatePostLaunchInsightsService(campaignId);
    const now = new Date().toISOString();

    // Save snapshot back into metadata_json
    const updatedMetadata = {
      ...existing,
      ...insights,
      insightsGeneratedAt: now,
    };

    await db
      .update(schema.campaigns)
      .set({ metadataJson: updatedMetadata })
      .where(eq(schema.campaigns.id, campaignId));

    res.json({ ...insights, cached: false, insightsGeneratedAt: now });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      message: error.message || 'Failed to generate insights. Please retry.',
      retryable: true,
    });
  }
}

/**
 * POST /api/ai/audience-rationale
 * Returns "Why This Audience?" explanation with predicted conversion and revenue.
 */
export async function getAudienceRationale(req: Request, res: Response, next: NextFunction) {
  try {
    const { segmentName, audienceSize, previewStats, channel, goal } = req.body;

    if (!segmentName || !channel || !goal) {
      return res.status(400).json({ 
        success: false, 
        message: 'segmentName, channel, and goal are required' 
      });
    }

    const stats = previewStats || {
      averageOrderValue: 0,
      potentialRevenue: 0,
      topPerformingCity: 'Unknown',
      averageOrdersCount: 0,
    };

    const rationale = await generateAudienceRationaleService(
      segmentName,
      audienceSize || 0,
      stats,
      channel,
      goal
    );

    res.json(rationale);
  } catch (error: any) {
    res.status(502).json({
      success: false,
      message: error.message || 'Failed to generate audience rationale. Please retry.',
      retryable: true,
    });
  }
}

export async function generateAnalyticsInsights(req: Request, res: Response, next: NextFunction) {
  try {
    const { campaignId, campaignIdB } = req.body;
    if (!campaignId) {
      return res.status(400).json({ success: false, message: 'campaignId is required' });
    }
    const insights = await generateAnalyticsInsightsService(campaignId, campaignIdB);
    res.json(insights);
  } catch (error) {
    next(error);
  }
}

export async function generateOptimizationSuggestions(req: Request, res: Response, next: NextFunction) {
  try {
    const { channel } = req.body;
    if (!channel) {
      return res.status(400).json({ success: false, message: 'channel is required' });
    }
    const suggestions = await generateOptimizationSuggestionsService(channel);
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
}

export async function enrichSegmentMetadata(req: Request, res: Response, next: NextFunction) {
  try {
    const { prompt, conditionsSummary, audienceCount } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'prompt is required' });
    }
    const enrichment = await generateSegmentEnrichmentService(
      prompt,
      conditionsSummary || '',
      typeof audienceCount === 'number' ? audienceCount : 0
    );
    res.json(enrichment);
  } catch (error) {
    next(error);
  }
}
