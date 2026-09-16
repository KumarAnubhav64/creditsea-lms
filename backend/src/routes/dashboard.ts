import { Router } from 'express';
import { leads, pendingSanction, pendingDisbursement, pendingCollection, allLoans } from '../controllers/dashboard';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(auth);

router.get('/sales/leads', requireRole('sales', 'admin'), leads);
router.get('/sanction/pending', requireRole('sanction', 'admin'), pendingSanction);
router.get('/disbursement/pending', requireRole('disbursement', 'admin'), pendingDisbursement);
router.get('/collection/pending', requireRole('collection', 'admin'), pendingCollection);
router.get('/admin/loans', requireRole('admin'), allLoans);

export default router;
