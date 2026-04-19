# AAC Plant Management

This project now runs as a full-stack app:

- Frontend: React + Vite
- Backend: Express API
- Database: MySQL (configured through `SQLSERVER_URL` env key)

## Environment Variables

Create `config/config.env` with:

```env
SQLSERVER_URL=mysql://username:password@hostname:3306/database_name?ssl=true
PORT=4000
VITE_API_BASE_URL=/api
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=8h
ADMIN_SETUP_KEY=one_time_setup_key
UPLOAD_DIR=server/uploads
```

Notes:
- `config/config.env` is now the primary editable backend config source.
- The backend expects only `SQLSERVER_URL` for database connection details (despite the variable name, it now points to MySQL).
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

## Backend Auth Bootstrap (Initial Setup)

Before first login, create users using bootstrap endpoint:

```bash
curl -X POST http://localhost:4000/api/auth/bootstrap \
	-H "Content-Type: application/json" \
	-H "x-setup-key: one_time_setup_key" \
	-d '{"users":[{"username":"sales1","password":"sales123","role":"sales"},{"username":"loading1","password":"load1234","role":"loading"},{"username":"accounts1","password":"acc12345","role":"accounts"},{"username":"manager1","password":"manage123","role":"management"},{"username":"prod1","password":"prod1234","role":"production"}]}'
```

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

Any publish/edit/status change done in the UI is now persisted to SQL Server through the backend API.

## New Backend Routes Added

- `POST /api/auth/bootstrap`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/orders`
- `POST /api/orders`
- `PATCH /api/orders/:id`
- `POST /api/orders/:id/transition`
- `POST /api/orders/:id/documents/invoice`
- `POST /api/orders/:id/approve`
- `POST /api/orders/:id/reject`
- `POST /api/orders/:id/dispatch`

Legacy compatibility routes are still available:

- `GET /api/state`
- `PUT /api/state/:key`

## cPanel Static Hosting (dist only)

If you upload only the `dist` folder, the frontend is static and cannot read `.env` on cPanel at runtime.
Use runtime config instead:

1. Build locally: `npm run build`
2. Upload all files inside `dist/` to your hosting path.
3. Edit `runtime-config.js` on server and set your backend base URL:

	`window.__AAC_CONFIG__ = { API_BASE_URL: 'https://your-backend-domain.com/api' };`

4. Ensure your backend API is running separately on a Node-capable host and CORS allows your frontend domain.

Notes:
- If backend is on same domain/path, keep `API_BASE_URL` as `/api`.
- Uploading only `dist` does not run Express backend by itself; login requires a live backend API.

## Backend Requirement

This app's auth, database access, and uploads require the Express backend runtime.
If your cPanel plan has no Node.js runtime, deploy only the frontend (`dist`) there and host backend separately.

Set these server env vars in your hosting provider:

- `SQLSERVER_URL`
- `JWT_SECRET`
- `ADMIN_SETUP_KEY`
- `UPLOAD_DIR`

After backend is live, point frontend runtime config to your API URL:

`window.__AAC_CONFIG__ = { API_BASE_URL: 'https://<your-api-host>/api' };`
