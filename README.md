# Pickup Xpress

Lean local demo MVP for the Pickup Xpress cafe pickup platform.

## Phase 1 Stack

- React + Vite frontend
- Node.js + Express API
- TypeScript across frontend and backend
- PostgreSQL database
- Prisma ORM and seed data

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   copy .env.example .env
   copy .env.example apps\server\.env
   copy .env.example apps\web\.env
   ```

3. Start PostgreSQL.

   If Docker is available:

   ```bash
   docker compose up -d postgres
   ```

   If Docker is not available, create a local PostgreSQL database matching the `DATABASE_URL`.

4. Create the database tables and seed demo data:

   ```bash
   npm run db:migrate
   npm run seed
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

Frontend: `http://localhost:5173`

API: `http://localhost:4000`

## Demo Seed Data

- Merchant: Cafe Stellaire
- Merchant login email: `merchant@cafestellaire.test`
- Demo menu: iced latte, chicken panini, momo pork, blueberry muffin, calamansi cooler
- Pickup slots: every 15 minutes from 11:00 AM to 2:00 PM

## Current Phase

Phase 2 provides the customer ordering flow:

- Live menu with category filters and cart quantity controls
- Pickup-slot selection with remaining-capacity display
- Customer details, order notes, and GCash, bank transfer, or cash payment choices
- Merchant-managed GCash and bank destination details (seeded with non-transactable demo values)
- Server-authoritative pricing, slot-capacity validation, and transactional order creation
- Order confirmation and protected status lookup by order number plus mobile number
- Read-only preview data when PostgreSQL is offline; final submission remains disabled

API routes:

- `GET /api/menu`
- `POST /api/orders`
- `GET /api/orders/:orderNumber?phone=...`
