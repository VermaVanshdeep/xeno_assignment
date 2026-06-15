import { Request, Response, NextFunction } from 'express';
import {
  createCampaign as createCampaignService,
  launchCampaign as launchCampaignService,
  cancelCampaign as cancelCampaignService,
  getCampaign as getCampaignService,
  listCampaigns as listCampaignsService
} from '../services/campaignService';

export async function createCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const { segmentId, name, channel, messageTemplate, metadataJson } = req.body;

    // Express request validation
    if (!segmentId) {
      return res.status(400).json({ success: false, message: 'segmentId is required' });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    if (!channel) {
      return res.status(400).json({ success: false, message: 'channel is required' });
    }
    if (!messageTemplate) {
      return res.status(400).json({ success: false, message: 'messageTemplate is required' });
    }

    const campaign = await createCampaignService({
      segmentId,
      name,
      channel,
      messageTemplate,
      metadataJson: metadataJson ?? {}
    });

    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
}

export async function launchCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await launchCampaignService(id);
    res.json(result);
  } catch (error: any) {
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
}

export async function cancelCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const campaign = await cancelCampaignService(id);
    res.json(campaign);
  } catch (error: any) {
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
}

export async function getCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const campaign = await getCampaignService(id);
    res.json(campaign);
  } catch (error: any) {
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
}

export async function listCampaigns(req: Request, res: Response, next: NextFunction) {
  try {
    const campaigns = await listCampaignsService();
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
}
