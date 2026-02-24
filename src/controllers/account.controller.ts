import { Request, Response } from 'express';
import { recordPayment, recordTransfer, getAccountStatement } from  '../services/account.services';

export async function handleRecordPayment(req: Request, res: Response) {
  try {
    const { accountId, amount, externalPaymentId } = req.body;

    if(accountId === undefined || !amount || amount === 0 || !externalPaymentId) {
      return res.status(400).json({ message: 'Account ID, payment amount, and EP ID must be valid' })
    }

    const result = await recordPayment(accountId, amount, externalPaymentId);
    res.json(result);
  }
  catch(err: any) {
    res.status(err.status ?? 500).json({ err: err.message });
  }
}

export async function handlePaymentTransfer(req: Request, res: Response) {
  try {
    const { fromAccountId, toAccountId, amount, transferId } = req.body;

    if(!fromAccountId || !toAccountId || !amount || amount === 0 || !transferId) {
      return res.status(400).json({ message: 'Invalid input' })
    }

    const result = await recordTransfer(fromAccountId, toAccountId, amount, transferId);
    res.json(result);
  } catch(err: any) {
      res.status(err.status ?? 500).json({ err: err.message });
  }
}

export async function getAccountStatement(req: Request, res: Response) {
  try {
    const accountId = Number(req.params.accountId);

    const { from, to, page ='1', pageSize = '20' } = req.query;

    if(!accountId || isNaN(accountId)) {
      return res.status(400).json({ message: 'Invalid accountId' });
    }

    if(!from || !to) {
      return res.status(400).json({ message: 'from and to dates are required' });
    }

    const result = await getAccountStatement({
      accountId,
      from: String(from),
      to: String(to),
      page: Number(page),
      size: Number(pageSize)
    });

    res.json(result);
  } catch(err: any) {
    res.status(500).json({ err: err.message });
  }
}