import { Request, Response } from 'express';
import { getDSRExportStatus, getValidationAccountStatus, getDSRPreview, exportDSRReport, changeAccountStatus } from '../services/dsr.services';

export async function previewDSR(req: Request, res: Response) {
  try {
    const { storeId, reportDate } = req.body;

    if(!storeId || !reportDate) {
      return res.status(400).json({ message: "storeId and reportDate are required" });
    }
    const result = await getDSRPreview(storeId, reportDate);
    res.json(result);
  } catch(err: any) {
    res.status(400).json({ err: err.message });
  }
};

export async function exportDSR(req: Request, res: Response) {
  try {
    const { storeId, reportDate } = req.body;

    if(!storeId || !reportDate) {
      return res.status(400).json({ message: "storeId and reportDate are required" });      
    }

    const result = await exportDSRReport(storeId, reportDate);
    res.json(result)
  } catch(err: any) {
    res.status(400).json({ err: err.message });
  }
};

export async function getExportStatus(req: Request<{ storeId: string; reportDate: string }>, res: Response) {
  try {
    const { storeId, reportDate } = req.params;

  if(!storeId || !reportDate) {
    return res.status(200).json({ message: "storeId and reportDate are required" });
  }

  const status = await getDSRExportStatus(storeId, reportDate);
  return res.status(200).json(status);
  } catch(err: any) {
    return res.status(err.status ?? 500).json({ err: err.message ?? 'Error' });
  }
}

export async function getAccountStatus(req: Request<{ accountId: string }>, res: Response) {
  try {
    const { accountId } = req.params;

    if(!accountId) {
      return res.status(400).json({ message: 'accountId is required' });
    }

    const status = await getValidationAccountStatus(accountId);
    return res.status(200).json(status);
  } catch(err: any) {
    return res.status(err.status ?? 500).json({ err: err.message ?? 'Error' });
  }
}

export async function updateAccStatus(req: Request, res: Response) {
  try {
    const { newStatus, accountNum } = req.body;

    if(typeof newStatus !== 'boolean' || typeof accountNum !== 'string') {
      return res.status(400).json({ message: 'Invalid input' });
    }

    const result = await changeAccountStatus(newStatus, accountNum);
    return res.status(200).json(result);
  } catch(err: any) {
    return res.status(err.status ?? 500).json({ err: err.message });
  }
}