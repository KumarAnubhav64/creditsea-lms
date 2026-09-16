import { Router } from 'express';
import { listLoans, getLoan, decide, disburse, recordPayment } from '../controllers/loans';
import { applyLoan } from '../controllers/borrower';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(auth);

// Borrower-facing action, mounted here to match the documented API surface (docs/API.md).
router.post('/apply', requireRole('borrower'), applyLoan);

router.get('/', requireRole('sanction', 'disbursement', 'collection', 'admin'), listLoans);
router.get('/:id', getLoan);
router.patch('/:id/decision', requireRole('sanction', 'admin'), decide);
router.patch('/:id/disburse', requireRole('disbursement', 'admin'), disburse);
router.post('/:id/payments', requireRole('collection', 'admin'), recordPayment);

export default router;
