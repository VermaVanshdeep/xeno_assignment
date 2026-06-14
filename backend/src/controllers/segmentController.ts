import { Request, Response, NextFunction } from 'express';
import {
  getAudienceCount,
  getAudiencePreview,
  getSegmentPreviewStats,
  createSegmentRecord,
  getSegmentRecord,
  listSegmentsRecords
} from '../services/segmentCompiler';
import { validateSegmentRule } from '../services/aiService';

export async function previewSegment(req: Request, res: Response, next: NextFunction) {
  try {
    const { rules } = req.body;
    if (!rules) {
      return res.status(400).json({ success: false, message: 'rules is required in request body' });
    }

    if (!validateSegmentRule(rules)) {
      return res.status(400).json({ success: false, message: 'Invalid segment rules AST structure' });
    }

    const count = await getAudienceCount(rules);
    const preview = await getAudiencePreview(rules);
    const stats = await getSegmentPreviewStats(rules);

    res.json({ count, preview, stats });
  } catch (error) {
    next(error);
  }
}

export async function createSegment(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, rules } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    if (!rules) {
      return res.status(400).json({ success: false, message: 'rules is required' });
    }

    if (!validateSegmentRule(rules)) {
      return res.status(400).json({ success: false, message: 'Invalid segment rules AST structure' });
    }

    const segment = await createSegmentRecord(name, description, rules);
    res.status(201).json(segment);
  } catch (error) {
    next(error);
  }
}

export async function getSegment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const segment = await getSegmentRecord(id);
    if (!segment) {
      return res.status(404).json({ success: false, message: `Segment with ID ${id} not found` });
    }
    res.json(segment);
  } catch (error) {
    next(error);
  }
}

export async function listSegments(req: Request, res: Response, next: NextFunction) {
  try {
    const segments = await listSegmentsRecords();
    res.json(segments);
  } catch (error) {
    next(error);
  }
}
