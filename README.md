# AAC Plant Management

This project now runs as a full-stack app:

- Frontend: React + Vite
- Backend: Express API (dev) or PHP API (shared hosting)
- Database: MySQL (configured through `SQLSERVER_URL` env key)

## Environment Variables

Create `config/config.env` with:

```env
SQLSERVER_URL=mysql://username:password@hostname:3306/database_name?ssl=true
PORT=4000
CORS_ORIGIN=https://your-frontend-domain.com
VITE_API_BASE_URL=/api
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=8h
ADMIN_SETUP_KEY=one_time_setup_key
UPLOAD_DIR=server/uploads
```

Notes:
- `config/config.env` is now the primary editable backend config source.
- The backend expects only `SQLSERVER_URL` for database connection details (despite the variable name, it now points to MySQL).
- Set `CORS_ORIGIN` to your frontend URL in production. Use comma-separated values if you have multiple origins.
- You can copy from `config/config.env.example` and then fill real values for deployment.

## Run In Development

Install dependencies:

```bash
npm install
```

Run frontend + backend together:

```bash
npm run dev
```

You can also run each service separately:

```bash
npm run server
npm run dev:client
```

## Backend Auth (Initial Setup)

The PHP API auto-creates default users on first run if the users table is empty.
Then login using:

`POST /api/auth/login`

with:

```json
{
	"username": "sales1",
	"password": "sales123"
}
```

## What Is Persisted In The Database

- Orders
- Diesel entries
- System logs
- Raw material stock
- Finished stock

Any publish/edit/status change done in the UI is now persisted to MySQL through the backend API.

## New Backend Routes Added

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/orders`
- `POST /api/orders`
- `PATCH /api/orders/:id`
- `PATCH /api/orders/:id/dispatched-edit`
- `POST /api/orders/:id/transition`
- `POST /api/orders/:id/documents/invoice`
- `POST /api/orders/:id/dispatch`
- `DELETE /api/orders/:id`

Legacy compatibility routes are still available:

- `GET /api/state`
- `PUT /api/state/:key`

## cPanel Shared Hosting (PHP + MySQL, No Node)

This repo now includes a PHP API under `api/` that matches the frontend contract.

1. Build frontend locally: `npm run build`
2. Upload all files inside `dist/` to your site root (for example `public_html/`).
3. Upload the full `api/` folder from this repo to `public_html/api/`.
4. Upload `config/config.env` (or set hosting env vars) with at least:

```env
SQLSERVER_URL=mysql://username:password@hostname:3306/database_name
JWT_SECRET=change_this_to_a_long_random_string
CORS_ORIGIN=https://your-frontend-domain.com
UPLOAD_DIR=api/uploads
```

5. Keep `runtime-config.js` set to:

`window.__AAC_CONFIG__ = { API_BASE_URL: '/api', USE_LOCAL_ONLY: false };`

6. Verify API directly in browser:

`https://your-domain.com/api/health`

Expected response:

```json
{"ok":true}
```

Default seeded users (first run only):
- `sales1 / sales123`
- `loading1 / load1234`
- `accounts1 / acc12345`
- `manager1 / manage123`
- `prod1 / prod1234`

### Dispatch Slip Uploads For Shared Hosting

To keep dispatch slips visually consistent with the local server layout, upload these files exactly as follows:

- Upload the full `api/` folder to `public_html/api/`.
- Upload the `public/` folder to `public_html/public/` so the dispatch slip generator can read the letterhead template asset from disk.
- Upload your built frontend (`dist/`) to `public_html/` or whatever folder serves the site root.
- Keep `api/uploads/dispatch-slips/` writable so generated slips can be saved there.

The PHP dispatch slip generator now writes a real PDF dispatch slip with the letterhead background, table rows, and signature lines. The hosted output no longer depends on HTML rendering.

### Secure Production Checklist

1. Never place DB credentials or JWT secrets in frontend files (`dist`, `runtime-config.js`, or browser `.env`).
2. Keep secrets only on backend host in `config/config.env` (or provider secret manager).
3. Keep frontend runtime config limited to non-secret API endpoint only:

	`window.__AAC_CONFIG__ = { API_BASE_URL: 'https://api.yourdomain.com/api' };`

4. Use HTTPS for both frontend and backend domains.
5. Set backend `CORS_ORIGIN` to your frontend domain (or comma-separated domains) and avoid wildcard origins in production.
6. Set a strong random `JWT_SECRET` on backend (do not use defaults).

## Backend Requirement

This app's auth, database access, and uploads require a server runtime.
Use either:
- Node/Express backend (existing `server/`)
- PHP backend for shared hosting (`api/`)

Set these server env vars in your hosting provider:

- `SQLSERVER_URL`
- `JWT_SECRET`
- `UPLOAD_DIR`

After backend is live, point frontend runtime config to your API URL:

`window.__AAC_CONFIG__ = { API_BASE_URL: 'https://<your-api-host>/api' };`
