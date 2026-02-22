import { pool } from '../db';
import { sendToQuickbooks } from '../services/qb.services';
import { retryWithBackoff } from '../utils/retry';

async function processPendingExports() {
  const client = await pool.connect();
  const MAX_CONCURRENT = 5;
  let rows: any[] = [];

  try {
    await client.query('BEGIN');

    const res = await client.query(
      `
      SELECT 
      e.id,
      e.store_id,
      e.report_date, 
      r.total_sales, 
      r.tax 
      FROM dsr_exports e
      JOIN dsr_reports r
        ON r.store_id = e.store_id
        AND r.report_date = e.report_date
      WHERE 
            (
              status = 'pending'
              AND (next_attempt_at is NULL OR next_attempt_at <= NOW())
            )
            OR (
              status = 'processing'
              AND processing_started_at < NOW() - INTERVAL '2 minutes'
            )
      FOR UPDATE SKIP LOCKED
      LIMIT $1
      `, [MAX_CONCURRENT]
    );

    rows = res.rows;

    if(rows.length === 0) {
      await client.query('COMMIT');
      return;
    }

    await client.query(`
      UPDATE dsr_exports
      SET status = 'processing',
        processing_started_at = now()
      WHERE id = ANY($1::int[])
      `, [rows.map(r => r.id)])

    await client.query('COMMIT');
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('Worker error:', err);
  } finally {
    client.release();
    console.log('Worker task completed');
  }

  await Promise.all(rows.map(row => handleExport(row)));
}

setInterval(processPendingExports, 50000);

async function handleExport(exportRow: any) {
  try {
    const qbResponse = await retryWithBackoff(() => 
      sendToQuickbooks({
        storeId: exportRow.store_id,
        reportDate: exportRow.report_date,
        totalSales: Number(exportRow.total_sales),
        tax: Number(exportRow.tax),
        idempotencyKey: `${exportRow.storeId}-${exportRow.report_date}`
      })
    );

    await pool.query(
      `
      UPDATE dsr_exports
      SET status = 'completed',
          qb_transaction_id = $1,
          exported_at = now()
      WHERE id = $2
      `,
      [qbResponse.qbTransactionId, exportRow.id]
    );

  } catch(err: any) {
    const MAX_RETRIES = 3;

    await pool.query(
      `
      UPDATE dsr_exports
      SET retry_count = retry_count + 1,
          last_error = $1,
          next_attempt_at = NOW() +
            (INTERVAL '10 seconds' * POWER(2, retry_count)),
          status = CASE
            WHEN retry_count + 1 >= $2 THEN 'failed'
            ELSE 'pending'
          END
        WHERE id = $3
      `,
      [err.message ?? 'Unkown error', MAX_RETRIES, exportRow.id]
    )
  }
}