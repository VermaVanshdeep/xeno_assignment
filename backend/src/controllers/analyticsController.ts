import { Request, Response, NextFunction } from 'express';
import { 
  getCampaignAnalytics as getCampaignAnalyticsService, 
  getCustomerAnalytics as getCustomerAnalyticsService, 
  getChannelPerformance as getChannelPerformanceService, 
  getDashboardMetrics as getDashboardMetricsService,
  getRevenueTrend as getRevenueTrendService,
  getCampaignPerformanceSummary as getCampaignPerformanceSummaryService
} from '../services/analyticsService';

export async function getDashboardMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const metrics = await getDashboardMetricsService();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
}

export async function getCampaignAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const analytics = await getCampaignAnalyticsService(id);
    res.json(analytics);
  } catch (error: any) {
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
}

export async function getChannelPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const performance = await getChannelPerformanceService();
    res.json(performance);
  } catch (error) {
    next(error);
  }
}

export async function getCustomerAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const analytics = await getCustomerAnalyticsService();
    res.json(analytics);
  } catch (error) {
    next(error);
  }
}

export async function getRevenueTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const trend = await getRevenueTrendService();
    res.json(trend);
  } catch (error) {
    next(error);
  }
}

export async function getCampaignsSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await getCampaignPerformanceSummaryService();
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

