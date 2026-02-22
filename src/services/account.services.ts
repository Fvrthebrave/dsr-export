import { pool } from '../db';

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
        ON CONFLICT (external_transfer_id) DO NOTHING
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