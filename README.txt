# Ledger API

Financial ledger service with idempotent transfers, payments, and ACID-safe balance updates.

## Tech Stack
- Node.js
- Express
- PostgreSQL
- TypeScript

## Features
- Idempotent transfers
- Row-level locking for concurrency safety
- Atomic debit enforcement
- Payment recording with duplicate protection

## Setup

1. Create database:
   createdb ledger

2. Run migrations:
   psql -d ledger -f migrations/init.sql

3. Start server:
   npm run dev