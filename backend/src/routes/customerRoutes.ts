import { Router } from 'express';
import { 
  createCustomer, 
  listCustomers, 
  getCustomer, 
  updateCustomer, 
  deleteCustomer 
} from '../controllers/customerController';

const router = Router();

router.post('/', createCustomer);
router.get('/', listCustomers);
router.get('/:id', getCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
