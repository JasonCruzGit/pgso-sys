# PGP-GSO Inventory Management System

Web-based Inventory Management System for the **Provincial Government of Palawan – Provincial General Supply Office (PGP PGSO)**.

## Stack

| Layer | Technology |
|-------|------------|
| Backend | Laravel 13 REST API |
| Frontend | React 19 + TypeScript + Tailwind CSS |
| Database | PostgreSQL 16 |
| Auth | JWT + RBAC (Argon2id password hashing) |
| Deployment | Docker Compose |

## Features

- Dashboard with inventory analytics and charts
- User management with 4 roles (Admin, GSO Officer, Department User, Auditor)
- Inventory, categories, stock receiving, and issuance workflow
- Department request portal with approval workflow
- QR code asset tracking
- Physical inventory audit and variance reporting
- PDF, Excel, and CSV report exports
- Immutable audit trail and in-app notifications
- Account lockout, rate limiting, and security headers

## Quick Start (Docker)

```bash
# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env

# Generate application key and JWT secret
docker compose run --rm backend php artisan key:generate
docker compose run --rm backend php artisan jwt:secret

# Start all services
docker compose up -d --build

# Run migrations and seed demo data
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed --force
```

Access:
- **Frontend:** http://localhost:5173
- **API:** http://localhost:8000/api

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| System Administrator | admin@gso.palawan.gov.ph | Admin@12345 |
| GSO Inventory Officer | officer@gso.palawan.gov.ph | Officer@12345 |
| Department User | dept@gso.palawan.gov.ph | Dept@12345 |
| Auditor | auditor@gso.palawan.gov.ph | Auditor@12345 |

> Change all passwords before production deployment.

## Local Development

### Backend
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan jwt:secret
php artisan migrate --seed
php artisan serve
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## API Overview

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /api/auth/login`, `refresh`, `logout`, `GET me` |
| Dashboard | `GET /api/dashboard` |
| Inventory | `CRUD /api/inventory`, `POST adjust` |
| Categories | `CRUD /api/categories` |
| Receiving | `GET/POST /api/stock-receipts` |
| Issuance | `CRUD /api/issuance`, approve/reject/release |
| Assets | `CRUD /api/assets`, `GET scan/{propertyNumber}` |
| Audits | `CRUD /api/inventory-audits`, verify/complete |
| Reports | `GET /api/reports/*?format=pdf\|excel\|csv` |
| Users | `CRUD /api/users` |
| Audit Logs | `GET /api/audit-logs` (read-only) |

## Security

- JWT access tokens with refresh token rotation
- Role-based access control on all endpoints
- Argon2id password hashing
- Login rate limiting (5/min) and account lockout after 5 failures
- Server-side input validation on all endpoints
- Prepared statements via Eloquent ORM
- Audit logging for all critical actions
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Environment-based configuration (no secrets in code)

## Database

Schema is managed via Laravel migrations in `backend/database/migrations/`.
Reference SQL: `database/schema.sql`

Tables: `roles`, `departments`, `users`, `refresh_tokens`, `categories`, `suppliers`, `inventory_items`, `stock_receipts`, `stock_receipt_items`, `issuance_requests`, `issuance_items`, `assets`, `stock_adjustments`, `inventory_audits`, `inventory_audit_items`, `audit_logs`, `notifications`

## Backups

Daily automated PostgreSQL backups run via the `backup` Docker service.
Backups stored in `docker/backup/` (retained 30 days).

## Production Notes

1. Set `APP_DEBUG=false` and strong `DB_PASSWORD` / `JWT_SECRET`
2. Configure HTTPS via reverse proxy (nginx/Apache)
3. Update `FRONTEND_URL` and `VITE_API_URL` for your LAN hostname
4. Change all seeded user passwords
5. Restrict PostgreSQL port exposure to internal network only

## License

Proprietary — Provincial Government of Palawan, Provincial General Supply Office.
