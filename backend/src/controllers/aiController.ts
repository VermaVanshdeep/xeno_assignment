import { Request, Response, NextFunction } from 'express';
import { 
  routeIntent as routeIntentService,
  generateSegmentRules as generateSegmentRulesService, 
  generateCampaignContent as generateCampaignContentService, 
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
