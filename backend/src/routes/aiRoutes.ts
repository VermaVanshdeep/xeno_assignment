import { Router } from 'express';
import { 
  routeIntent,
  generateSegmentRules, 
  generateCampaignContent, 
  generateCampaignDraft,
  regenerateCampaignField,
  getCampaignPostLaunchInsights,
  getAudienceRationale,
  generateAnalyticsInsights, 
  generateOptimizationSuggestions,
  enrichSegmentMetadata
} from '../controllers/aiController';

const router = Router();

router.post('/route', routeIntent);
router.post('/segment', generateSegmentRules);
router.post('/segment-enrich', enrichSegmentMetadata);

// Legacy AI copilot endpoint
router.post('/campaign', generateCampaignContent);

// New AI-first Campaign workflow endpoints
router.post('/campaign/draft', generateCampaignDraft);
router.post('/campaign/regenerate-field', regenerateCampaignField);
router.post('/campaign/post-launch-insights', getCampaignPostLaunchInsights);
router.post('/audience-rationale', getAudienceRationale);

router.post('/insights', generateAnalyticsInsights);
router.post('/optimize', generateOptimizationSuggestions);

export default router;
