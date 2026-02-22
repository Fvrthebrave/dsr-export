-- 001_init.sql
-- Initial schema for DSR Export / Ledger System
BEGIN;
-- =========================
-- ACCOUNTS
-- =========================
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    balance BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT balance_non_negative CHECK (balance >= 0)
);

-- =========================
-- TRANSFERS
-- =========================
CREATE TABLE IF NOT EXISTS transfers (
    id SERIAL PRIMARY KEY,
    external_transfer_id TEXT NOT NULL UNIQUE, -- idempotency key
    from_id INTEGER NOT NULL REFERENCES accounts(id),
    to_id INTEGER NOT NULL REFERENCES accounts(id),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- TRANSACTIONS
-- =========================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    trans_type TEXT NOT NULL CHECK (trans_type IN ('debit', 'credit')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- PAYMENTS
-- =========================
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    external_payment_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_id ON transactions(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_account_id ON payments(account_id);

COMMIT;