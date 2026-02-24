import { Router } from 'express';
import { handleRecordPayment, handlePaymentTransfer, getAccountStatement } from '../controllers/account.controller';

const router = Router();

router.post('/payments', handleRecordPayment)
router.post('/payments/transfer', handlePaymentTransfer);
router.get('/:accountId/statement', getAccountStatement);

export default router;