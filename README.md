# Allo Inventory Reservation App

A full‑stack inventory reservation system built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, and **Prisma** (PostgreSQL).  

## Features
- Create, read, update, delete inventory items
- Pessimistic locking with `SELECT … FOR UPDATE` to prevent over‑booking
- Idempotent reservation API
- Background worker that expires stale reservations
- Server‑side API routes (`/api/*`) that work on Vercel/Railway runtimes

## Local Development
```bash
# Install dependencies
npm install

# Set up the database (PostgreSQL)
# See prisma/schema.prisma for model definitions
npx prisma migrate dev

# Run the dev server
npm run dev
```

## Deployment
The app can be deployed with **Vercel** or **Railway** via their Git integration:
- Push this repo to GitHub (already done).
- In Vercel: *Import Project* → select this repo → deploy.
- In Railway: *New Project* → *Deploy from GitHub* → select this repo → deploy.

The live URL will be something like `https://<project>.vercel.app` or `https://<project>.railway.app`.

---
*This README was generated automatically by the Antigravity assistant.*
