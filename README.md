# Pickup Xpress

Customer ordering and merchant operations platform for scheduled express pickup.

## Stack

- React + Vite frontend
- Node.js + Express API
- TypeScript across frontend and backend
- MariaDB database
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

3. Start MariaDB.

   If Docker is available:

   ```bash
   docker compose up -d mariadb
   ```

   If Docker is not available, create a local MariaDB database matching the `DATABASE_URL`.

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

Merchant admin: `http://localhost:5173/admin`

API: `http://localhost:4000`

## Demo Seed Data

- Merchant: Cafe Stellaire
- Merchant login email: `merchant@cafestellaire.test`
- Merchant login password: the value of `ADMIN_SEED_PASSWORD` (`PickupXpress123!` in the example environment)
- Demo menu: iced latte, chicken panini, momo pork, blueberry muffin, calamansi cooler
- Pickup slots: every 15 minutes from 11:00 AM to 2:00 PM

## Implemented Phases

### 1. Customer ordering foundation

- Live menu with category filters and cart quantity controls
- Pickup-slot selection with remaining-capacity display
- Customer details, order notes, and GCash, bank transfer, or cash payment choices
- Merchant-managed GCash and bank destination details (seeded with non-transactable demo values)
- Server-authoritative pricing, slot-capacity validation, and transactional order creation
- Order confirmation and protected status lookup by order number plus mobile number
- Read-only preview data when MariaDB is offline; final submission remains disabled

### 2. Merchant authentication

- Password hashing with secure, HTTP-only session cookies
- Protected merchant APIs, session expiry, login throttling, and logout revocation
- Admin workspace at `/admin`

### 3. Menu and inventory

- Category and item management, pricing, descriptions, availability, and images
- Ingredient or stock-item records with units, reorder levels, and current weighted unit cost
- Product recipes that define the stock consumed per completed item
- Purchase and correction history with low-stock warnings

### 4. Store operations and reporting

- Kitchen workflow: pending, accepted, preparing, ready, and completed
- Manual GCash, bank, and cash confirmation
- Transactional stock deduction and cost snapshots on completion
- Daily and 7-day sales, gross profit, order counts, best sellers, and recent activity
- Pickup slot scheduling, capacity, opening, closing, and safe removal

API routes:

- `GET /api/menu`
- `POST /api/orders`
- `GET /api/orders/:orderNumber?phone=...`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- Protected admin routes under `/api/admin` for dashboard, orders, catalog, inventory, recipes, payments, and pickup slots

## Change an Admin Password

Set temporary environment values, run the password command, and then remove the values from the shell or hosting panel:

```powershell
$env:ADMIN_EMAIL="merchant@cafestellaire.test"
$env:ADMIN_PASSWORD="use-a-unique-password-here"
npm run admin:set-password
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
```

This updates only the password and revokes existing sessions. It does not alter menu, slot, order, or inventory data.

## cPanel Deployment

The production build can run as one cPanel Node.js application, with Express serving both the frontend and API from the same subdomain. See [CPANEL_DEPLOYMENT.md](./CPANEL_DEPLOYMENT.md) for the required hosting features and deployment steps.
