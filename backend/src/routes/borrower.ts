import { Router } from 'express';
import { getStage, updateDetails, uploadSalarySlip, updateLoanConfig, myLoans, recordPayment } from '../controllers/borrower';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { salarySlipUpload } from '../middleware/upload';

const router = Router();

router.use(auth, requireRole('borrower'));

router.get('/stage', getStage);
router.put('/details', updateDetails);
router.post('/salary-slip', salarySlipUpload.single('file'), uploadSalarySlip);
router.patch('/loan-config', updateLoanConfig);
router.get('/loans', myLoans);
router.post('/loans/:id/payments', recordPayment);

export default router;
