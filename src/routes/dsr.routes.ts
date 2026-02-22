import { Router } from 'express';
import { getExportStatus, getAccountStatus, previewDSR, exportDSR, updateAccStatus } from '../controllers/dsr.controller';

const router = Router();

router.post('/preview', previewDSR);
router.post('/export', exportDSR);
router.get('/accounts/status/:accountId', getAccountStatus);
router.patch('/accounts/status', updateAccStatus);
router.get('/exports/:storeId/:reportDate', getExportStatus);

export default router;