import { Router } from 'express';
import { 
  routeIntent,
  generateSegmentRules, 
  generateCampaignContent, 
  generateAnalyticsInsights, 
  generateOptimizationSuggestions,
  enrichSegmentMetadata
} from '../controllers/aiController';

const router = Router();

router.post('/route', routeIntent);
router.post('/segment', generateSegmentRules);
router.post('/segment-enrich', enrichSegmentMetadata);
router.post('/campaign', generateCampaignContent);
router.post('/insights', generateAnalyticsInsights);
router.post('/optimize', generateOptimizationSuggestions);

export default router;
