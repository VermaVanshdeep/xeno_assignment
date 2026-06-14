import { Router } from 'express';
import { 
  getDashboardMetrics, 
  getCampaignAnalytics, 
  getChannelPerformance, 
  getCustomerAnalytics,
  getRevenueTrend,
  getCampaignsSummary
} from '../controllers/analyticsController';

const router = Router();

router.get('/dashboard', getDashboardMetrics);
router.get('/campaigns-summary', getCampaignsSummary);
router.get('/campaigns/:id', getCampaignAnalytics);
router.get('/channels', getChannelPerformance);
router.get('/customers', getCustomerAnalytics);
router.get('/revenue-trend', getRevenueTrend);

export default router;
