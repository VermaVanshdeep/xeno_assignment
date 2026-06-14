import { Router } from 'express';
import {
  previewSegment,
  createSegment,
  getSegment,
  listSegments
} from '../controllers/segmentController';

const router = Router();

router.post('/preview', previewSegment);
router.post('/', createSegment);
router.get('/', listSegments);
router.get('/:id', getSegment);

export default router;
