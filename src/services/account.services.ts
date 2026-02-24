import { pool } from '../db';

interface StatementParams {
  accountId: number;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

export async function recordPayment(accountId: number, amount: number, externalPaymentId: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertResult = await client.query(`
        INSERT INTO payments (account_id, amount, external_payment_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (external_payment_id)
        DO NOTHING
        RETURNING id
      `,[accountId, amount, externalPaymentId]);

      if(insertResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return { success: true, idempotent: true };
      }

      await client.query(`
          UPDATE accounts
          SET balance = balance + $1
          WHERE id = $2
        `,[amount, accountId]);

        await client.query('COMMIT');
        return { success: true, idempotent: false }
  } catch(err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export async function recordTransfer(fromAccountId: number, toAccountId: number, amount: number, transferId: string) {
  const client = await pool.connect();

  if(fromAccountId === toAccountId) {
    throw new Error('You cannot transfer to and from the same account');
  }

  if(!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Amount must be a positive integer');
  }

  try {
    await client.query('BEGIN');
    const transferResult = await client.query(`
        INSERT INTO transfers (from_id, to_id, amount_cents, external_transfer_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (external_transfer_id) 
        DO NOTHING
        RETURNING *
      `, [fromAccountId, toAccountId, amount, transferId]);


    if (transferResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { success: true, idempotent: true };
    }

    const [firstId, secondId] =
      fromAccountId < toAccountId
      ? [fromAccountId, toAccountId]
      : [toAccountId, fromAccountId];

    const lockResult = await client.query(`
        SELECT id FROM accounts
        WHERE id IN ($1, $2)
        ORDER BY id
        FOR UPDATE;
      `, [firstId, secondId])

      if(lockResult.rowCount !== 2) {
        throw new Error('One or both accounts not found');        
      }

      const debitResult = await client.query(`
          UPDATE accounts 
          SET balance = balance - $1
            WHERE id = $2
              AND balance >= $1
              RETURNING *
        `, [amount, fromAccountId])

      if(debitResult.rowCount === 0) {
        throw new Error('Insufficient funds');
      }

      const creditResult = await client.query(`
          UPDATE accounts
          SET balance = balance + $1
          WHERE id = $2
          RETURNING *
        `, [amount, toAccountId]);
      
      if(creditResult.rowCount === 0) {
        throw new Error('Destination account not found');
      }

      await client.query(`
          INSERT INTO transactions (transfer_id, amount, trans_type)
          VALUES ($1, $2, $3)
        `, [transferResult.rows[0].id, amount, 'debit']);

      await client.query(`
          INSERT INTO transactions (transfer_id, amount, trans_type)
          VALUES ($1, $2, $3)
        `, [transferResult.rows[0].id, amount, 'credit']);

    await client.query('COMMIT');
    return { message: 'Transfer successful' }
  } catch(err: any) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getAccountStatement({
  accountId,
  from,
  to,
  page,
  pageSize
}: StatementParams) {

  const offset = (page - 1) * pageSize;

  const result = await pool.query(`
      SELECT
        t.id,
        t.amount,
        t.trans_type,
        t.created_at,
        t.transfer_id
      FROM transactions t
      WHERE t.ccount_id = $1
        AND t.created_at BETWEEN $2 AND $3
        ORDER by t.created_at DESC
        LIMIT $4 OFFSET $5
    `,[accountId, from, to, pageSize, offset]);

    if(result.rowCount === 0) {
      throw new Error('No matching transactions found for the supplied accountId and/or date range');
    }

  const countResult = await pool.query(`
      SELECT COUNT(*)
      FROM transactions
      WHERE account_id = $1
        AND created_at BETWEEN $2 AND $3
    `,[accountId, from, to])

  return {
    accountId,
    page,
    pageSize,
    totalRecords: Number(countResult.rows[0].count),
    transactions: result.rows
  }
}