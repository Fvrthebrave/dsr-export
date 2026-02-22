import { pool } from '../db'
import { sendToQuickbooks } from './qb.services';
import { retryWithBackoff } from '../utils/retry';

export async function getValidationAccountStatus(accountId: string) {
  const result = await pool.query(
    `
    SELECT *
    FROM validation_accounts
      WHERE account_number = $1
    `, [accountId]
  )

  if(result.rows.length === 0) {
    throw new Error('No accounts match that accountId');
  }

  const row = result.rows[0];
  return {
    accountId: row.account_number,
    clientName: row.client_name,
    isActive: row.is_active
  }
};

export async function changeAccountStatus(newStatus: boolean, accountNum: string) {
  const requiredCurrentState = !newStatus;

  const result = await pool.query(
    `
      UPDATE validation_accounts
      SET is_active = $1
      WHERE account_number = $2
        AND is_active = $3
        RETURNING id, is_active
    `, [newStatus, accountNum, requiredCurrentState]
  );

  if(result.rows.length === 0) {
    const err: any = new Error('Invalid state transition or account not found');
    err.status = 400;
    throw err;
  }

  return result.rows[0];
}

export async function getDSRExportStatus(storeId: string, reportData: string) {
  const result = await pool.query(
    `
    SELECT * FROM dsr_exports
    WHERE store_id = $1
      AND report_date = $2
    `,
    [storeId, reportData]
  )

  if(result.rows.length === 0) {
    const err:any = new Error('No export record found for that store/date');
    err.status = 404;
    throw err;
  }

  const row = result.rows[0];

  return {
    storeId: row.store_id,
    reportDate: row.report_date,
    status: row.status,
    qbTransactionId: row.qb_transaction_id ?? null,
    exportedAt: row.exported_at ?? null,
    retryCount: row.retry_count,
    lastError: row.last_error ?? null
  };
}

export async function getDSRPreview(storeId: string, reportDate: string) {
  if(!storeId || !reportDate) {
    throw new Error('Missing store ID or report date');
  }

  const result = await pool.query(
    `
    SELECT store_id, report_date, account_number,
           total_sales, tax, cash, card
    FROM dsr_reports
    WHERE store_id = $1 AND report_date = $2`,
    [storeId, reportDate]
  );

  if(result.rows.length === 0) {
    throw new Error('No DSR found for that store/date');
  }

  const row = result.rows[0];

  return {
    storeId: row.store_id,
    reportDate: row.report_date,
    accountNum: row.account_number,
    totalSales: row.total_sales,
    tax: row.tax,
    cash: row.cash,
    card: row.card
  }
}

export async function exportDSRReport(storeId: string, reportDate: string) {
  const client = await pool.connect();
  let dsr: any;
  
  try {
    await client.query('BEGIN');

    const dsrResult = await client.query(`
      SELECT *
      FROM dsr_reports
      WHERE store_id = $1
      AND report_date = $2
      `,
      [storeId, reportDate]
    );

    if(dsrResult.rows.length === 0) {
      const err: any = new Error('DSR not found');
      err.status = 404;
      throw err;
    }

    dsr = dsrResult.rows[0];

    const accountCheck = await client.query(`
      SELECT 1
      FROM validation_accounts
      WHERE account_number = $1
      AND is_active = true
      `,
      [dsr.account_number]
    );

    if(accountCheck.rows.length === 0) {
      const err: any = new Error('Invalid or inactive account')
      err.status = 400;
      throw err;
    }

    await client.query(`
      INSERT INTO dsr_exports (
        store_id, 
        report_date, 
        status,
        retry_count)
      VALUES ($1, $2, 'processing', 0)
      `,
      [storeId, reportDate]
    );

    await client.query('COMMIT');

    return {
      success: true,
      status: 'pending'
    }
  } catch(err: any) {
    await client.query('ROLLBACK');

    if(err.code === '23505') {
      return {
        success: true,
        idempotent: true,
        status: 'pending'
      }
    }

    throw err;
  } finally {
    client.release();
  }
}