# AAC Plant Management

This project now runs as a full-stack app:

- Frontend: React + Vite
- Backend: Express API
- Database: MongoDB Atlas

## Environment Variables

Create a `.env` file in the project root (already added in this workspace) with:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
MONGODB_DB=aac_plant_management
PORT=4000
VITE_API_BASE_URL=/api
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=8h
ADMIN_SETUP_KEY=one_time_setup_key
UPLOAD_DIR=server/uploads
```

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

## What Is Persisted In MongoDB

- Orders
- Diesel entries
- System logs
- Raw material stock
- Finished stock

Any publish/edit/status change done in the UI is now persisted to MongoDB through the backend API.

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

4. Ensure your backend API is running separately (Node host/VPS/cPanel Node app) and CORS allows your frontend domain.

Notes:
- If backend is on same domain/path, keep `API_BASE_URL` as `/api`.
- Uploading only `dist` does not run Express backend by itself; login requires a live backend API.

## Deploy Backend On Render (Blueprint)

This repo includes `render.yaml` for backend API deployment.

1. Push this repository to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Connect the GitHub repo and select this project.
4. Render will read `render.yaml` and create service `aac-plant-api`.
5. In Render dashboard, open the service and set secret env values:
	- `MONGODB_URI`
	- `JWT_SECRET`
	- `ADMIN_SETUP_KEY`
6. Deploy and verify health URL: `/api/health`.

After backend is live, point frontend runtime config to Render API URL:

`window.__AAC_CONFIG__ = { API_BASE_URL: 'https://<your-render-service>.onrender.com/api' };`
