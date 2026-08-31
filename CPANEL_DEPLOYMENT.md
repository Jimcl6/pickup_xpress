# cPanel Deployment

Pickup Xpress runs as one Node.js application. Express serves the React build and the API from the same subdomain.

## Hosting Requirements

Confirm that the cPanel account includes:

- Setup Node.js App, Application Manager, or an equivalent Passenger-based Node.js feature
- Node.js 22.12 or newer
- MySQL Databases backed by MariaDB
- Terminal or SSH access, or another way to run npm and Prisma commands
- SSL for the chosen subdomain

Pickup Xpress uses Prisma's MySQL provider, which supports the MariaDB database supplied by cPanel.

## 1. Create the Database

In **MySQL Databases**:

1. Create a database and database user.
2. Add the user to the database with all privileges.
3. Keep the cPanel-prefixed database name and username shown by cPanel.

The connection string normally has this form:

```text
mysql://CPANEL_USER_DBUSER:PASSWORD@localhost:3306/CPANEL_USER_DBNAME
```

URL-encode reserved characters in the password.

## 2. Upload the Application

Clone the Git repository through **Git Version Control**, or upload the project into a directory outside `public_html`, for example:

```text
/home/CPANEL_USER/pickup-xpress
```

Do not upload local `.env` files or `node_modules`.

## 3. Create the Node.js Application

In **Setup Node.js App** use:

| Setting | Value |
| --- | --- |
| Node.js version | 22.12 or newer |
| Application mode | Production |
| Application root | `pickup-xpress` |
| Application URL | The selected subdomain |
| Application startup file | `server.cjs` |

Add these environment variables in the cPanel Node.js application screen:

```text
NODE_ENV=production
DATABASE_URL=mysql://CPANEL_USER_DBUSER:PASSWORD@localhost:3306/CPANEL_USER_DBNAME
SESSION_DAYS=7
ADMIN_SEED_PASSWORD=REPLACE_WITH_A_UNIQUE_INITIAL_PASSWORD
```

Do not set `PORT`; cPanel supplies it to the application. `CORS_ORIGIN` is unnecessary when the site and API use the same subdomain.

## 4. Install and Build

Open cPanel Terminal, enter the application directory, and activate the Node.js environment using the command displayed by **Setup Node.js App**. Then run:

```bash
npm install --include=dev
npm run db:generate
npm run build
npm run db:deploy
npm run seed
```

The seed command installs demo merchant data and creates tomorrow's pickup slots. Do not rerun it after real orders exist because it replaces that merchant's pickup slots.

Remove `ADMIN_SEED_PASSWORD` from the hosting environment after the first seed. To rotate the admin password later, set `ADMIN_EMAIL` and `ADMIN_PASSWORD`, run `npm run admin:set-password`, then remove both temporary values. This command changes only the password and revokes active admin sessions.

Return to **Setup Node.js App** and restart the application.

## 5. Verify

Open these URLs over HTTPS:

```text
https://SUBDOMAIN/
https://SUBDOMAIN/api/health
https://SUBDOMAIN/api/menu
https://SUBDOMAIN/admin
```

The health endpoint must return:

```json
{"ok":true,"database":"connected"}
```

Complete one cash-on-pickup test order and confirm that the confirmation screen shows an order number beginning with `PX-`.

Sign in to `/admin`, accept the test order, confirm cash received, move it through preparing and ready, then complete it. Verify that the dashboard records the sale and the related recipe stock is reduced exactly once.

## Updating the Site

After pulling or uploading a new revision, activate the application environment and run:

```bash
npm install --include=dev
npm run db:generate
npm run build
npm run db:deploy
```

Restart the Node.js application in cPanel. Do not run the demo seed command during routine updates.
