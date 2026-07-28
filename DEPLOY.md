# Deploy notes — GitHub + Vercel (full stack)

## What goes where

| Layer | Host |
|-------|------|
| Source code | [GitHub — JasonCruzGit/pgso-sys](https://github.com/JasonCruzGit/pgso-sys) |
| Frontend (React/Vite) | **Vercel** project `pgso-sys` |
| Backend (Laravel API) | **Vercel** project `pgso-sys-api` ([vercel-php](https://github.com/vercel-community/php)) |
| Database | **Neon / Vercel Postgres** (or Supabase). Not on the serverless filesystem. |

## Live URLs

| Resource | URL |
|----------|-----|
| Frontend | https://frontend-zeta-five-16.vercel.app |
| API | https://pgso-sys-api.vercel.app |
| GitHub | https://github.com/JasonCruzGit/pgso-sys |

Frontend env: `VITE_API_URL=https://pgso-sys-api.vercel.app/api`

## Deploy frontend

```bash
cd frontend
vercel --prod
```

Project settings: Root Directory = `frontend`, Framework = Vite.

## Deploy API

```bash
cd backend
vercel --prod
```

Required production env (Vercel → pgso-sys-api → Settings → Environment Variables):

- `APP_KEY` (base64:…)
- `JWT_SECRET`
- `APP_URL` = `https://pgso-sys-api.vercel.app`
- `FRONTEND_URL` = your frontend URL
- `DB_CONNECTION` = `pgsql`
- `DB_HOST` / `DB_PORT` / `DB_DATABASE` / `DB_USERNAME` / `DB_PASSWORD`  
  (or a single `DATABASE_URL` if you add support)

After DB is connected, run migrations once (from a machine with network access to the DB):

```bash
cd backend
php artisan migrate --force --seed
```

## Add Postgres on Vercel

1. Vercel Dashboard → **Storage** → create **Neon Postgres** (or connect Supabase).
2. Copy connection fields into `pgso-sys-api` env vars.
3. Redeploy API: `cd backend && vercel --prod`
