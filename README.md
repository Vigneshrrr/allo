# Allo Multi-Warehouse Inventory & Fulfillment Platform

Welcome to the Allo Inventory Take-Home Exercise implementation. This repository contains a production-grade, highly optimized Next.js application that manages checkout holdings and real-time inventory reservations across multiple warehouses, fully correct under high-concurrency race conditions.

---

## 🚀 Live Demo & Host Exposing
To allow you to demo the app instantly without any database setup on your side, the app boots up out-of-the-box with a pre-seeded, self-contained SQLite configuration that works in one click.

### Quick Start (Run Locally in 60 seconds)
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Setup Database (Auto-generates SQLite & pre-seeds data)**:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
3. **Start Next.js Development Server**:
   ```bash
   npm run dev
   ```
4. **Access Locally**: Open [http://localhost:3000](http://localhost:3000)

---

## 🔒 Concurrency Correctness (Race-Condition-Free)
The core challenge is preventing two customers from reserving the same physical stock unit during overlapping checkout windows under high parallel loads (e.g. flash sales).

### How We Guarantee Concurrency Correctness:
We implement a **pessimistic row-locking pattern** using PostgreSQL-level atomic transactions:
1. When a client requests `POST /api/reservations`, we enter an isolated database transaction block (`prisma.$transaction`).
2. Inside, we run a raw SQL query with a **`FOR UPDATE` lock** on the exact `StockLevel` row associated with the requested `productId` and `warehouseId`:
   ```sql
   SELECT id, "totalUnits", "reservedUnits"
   FROM "StockLevel"
   WHERE "productId" = $1 AND "warehouseId" = $2
   FOR UPDATE
   ```
3. **The Lock in Action:** In PostgreSQL, the `FOR UPDATE` statement locks the retrieved row. If a concurrent transaction tries to read or update the same row, it is **blocked and forced to wait** until the first transaction completes or rolls back.
4. **Stock Calculation:** Once the lock is acquired, we fetch the latest up-to-date counts and assert:
   ```typescript
   const available = totalUnits - reservedUnits;
   if (available < quantity) throw new Error("INSUFFICIENT_STOCK");
   ```
   - If stock is insufficient, the transaction immediately rolls back, unlocking the row and returning a `409 Conflict`.
   - If stock is available, we increment `reservedUnits` and insert the `Reservation` record inside the same transaction before committing, ensuring absolute consistency.

*Note: For the zero-setup local SQLite demo, SQLite automatically serializes write transactions globally, guaranteeing the exact same race-condition-free behavior natively.*

---

## ⏳ Reservation Expiry Mechanism

To prevent abandoned checkouts from permanently locking inventory (which ruins conversion metrics), we implement a **two-pronged auto-release pipeline**:

### 1. Lazy Cleanup on Read (Serverless Safe)
Whenever `/api/products` or a specific reservation GET endpoint is hit, the server executes a fast, locked cleanup procedure in the background:
- It queries for any `PENDING` reservations where `expiresAt < now`.
- It dynamically updates their status to `RELEASED` and decrements `reservedUnits` on the corresponding `StockLevel` records within locked transaction blocks.
- This ensures that stock numbers returned to customers are **100% accurate at the moment of read**, even on serverless environments like Vercel where active background threads do not run.

### 2. Active Server-Side Background Worker
When the server starts (e.g., in Node.js, Next.js dev server, or container platforms), the Prisma Client singleton boots a lightweight, non-blocking **active interval worker** (running every 10 seconds).
- This worker periodically polls the database and automatically releases expired holds.
- This results in a dynamic and live experience where expired holds vanish and stock rebounds without needing any manual user refresh.

### 3. Vercel Cron Support
We have implemented a GET route at `/api/cron/cleanup` designed for Vercel Cron. This can be scheduled to run every minute via standard crons to trigger active purging in serverless production environments.

---

## 🔂 Idempotency Layer (Bonus)

We have fully implemented the idempotency bonus for both the **Reserve** and **Confirm** endpoints using standard `Idempotency-Key` HTTP headers backed by a persistent database log.

### How It Works:
1. When a request hits `POST /api/reservations` or `POST /api/reservations/:id/confirm`, the API looks for the `Idempotency-Key` header.
2. We query the `IdempotencyRecord` table for a match.
3. **If a record is found:** We immediately bypass the request execution, read the saved HTTP status and JSON response body from the database, and replay it instantly with the `X-Idempotent-Replay: true` header.
4. **If no record is found:** We proceed with the execution, commit the side effects, and insert a new `IdempotencyRecord` detailing the response.

This guarantees that if a network glitch causes a payment callback or reservation click to retry, the customer **never gets billed twice and never double-reserves stock**.

---

## 🔌 Easily Switch to PostgreSQL (Neon / Supabase)

The codebase has been engineered to be **fully dual-compatible**. To connect your hosted PostgreSQL instance:

1. Update your `.env` file with your hosted database connection string:
   ```env
   DATABASE_URL="postgresql://user:password@ephemeral-db-id.neon.tech/neondb?sslmode=require"
   ```
2. Open `prisma/schema.prisma` and update the provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Run the migrations:
   ```bash
   npx prisma db push
   ```
Prisma will generate the Postgres-compatible client, and our codebase will automatically switch from SQLite fallbacks to executing the high-performance raw `FOR UPDATE` pessimistic row locks!

---

## 📊 Trade-offs & Future Enhancements

With more time, the following improvements would be integrated:
1. **Redis-Backed Distributed Locks**: Instead of relying purely on database-level pessimistic locking, using Redis (`redlock` or Upstash) would allow us to lock SKUs at the cache layer, offloading compute from the primary database under extreme global traffic.
2. **WebSockets for Live Stock Updates**: Currently, stock counts refresh on page load or when reservations are initiated. Adding Socket.io or Pusher would push inventory changes to checkout clients in real time.
3. **Distributed Transaction Sagas**: For multi-service retail systems, reservation holdings would coordinate with inventory, shipping, and payment gateways using a Saga orchestrator to guarantee eventual consistency across microservices.
