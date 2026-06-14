import { Router } from 'express';
import { createOrder, getOrder, deleteOrder } from '../controllers/orderController';
import { ocrImport } from '../controllers/ocrController';

const router = Router();

router.post('/ocr', ocrImport);     // Invoice/Receipt OCR import
router.post('/', createOrder);
router.get('/:id', getOrder);
router.delete('/:id', deleteOrder);

export default router;
