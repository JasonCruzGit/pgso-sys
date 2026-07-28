# Deploy notes — GitHub + Vercel

## What goes where

| Layer | Host |
|-------|------|
| Source code | [GitHub — JasonCruzGit/pgso-sys](https://github.com/JasonCruzGit/pgso-sys) |
| Frontend (React) | **Vercel** |
| Backend (Laravel API) | Not on Vercel — use Hostinger VPS, Railway, Fly.io, or similar |
| Database | Local Docker Postgres now; **Supabase** Postgres for production |

Vercel only serves the static Vite build. API calls need `VITE_API_URL` pointing at your Laravel host.

## Push to GitHub

```bash
cd /path/to/INV-PGP-GSO
git init
git add .
git commit -m "Initial commit: PGP PGSO inventory system"
git branch -M main
git remote add origin https://github.com/JasonCruzGit/pgso-sys.git
git push -u origin main
```

## Deploy frontend with Vercel CLI

```bash
npm i -g vercel
cd frontend
vercel login
vercel link          # link to project; set Root Directory = frontend if linking from repo root
vercel env add VITE_API_URL production   # e.g. https://api.your-domain.com/api
vercel --prod
```

Or from repo root (uses root `vercel.json`):

```bash
vercel --prod
```

## Vercel project settings (dashboard)

- **Root Directory:** `frontend`
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment:** `VITE_API_URL` = your Laravel API base URL (must include `/api`)
