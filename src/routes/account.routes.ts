import { Router } from 'express';
import { handleRecordPayment, handlePaymentTransfer } from '../controllers/account.controller';

const router = Router();

router.post('/payments', handleRecordPayment)
router.post('/payments/transfer', handlePaymentTransfer);

export default router;