import { Router } from 'express';
import {
  createCampaign,
  launchCampaign,
  cancelCampaign,
  getCampaign,
  listCampaigns
} from '../controllers/campaignController';

const router = Router();

router.post('/', createCampaign);
router.post('/:id/launch', launchCampaign);
router.post('/:id/cancel', cancelCampaign);
router.get('/', listCampaigns);
router.get('/:id', getCampaign);

export default router;
