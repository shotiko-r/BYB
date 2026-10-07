# BYB — Before You Buy

A product comparison platform that helps users find the best prices across multiple merchants before making a purchase.

## Overview

BYB is **not an online store**. Users search for products on BYB, compare offers from multiple merchants (Amazon, Temu, AliExpress, eBay, etc.), then click through to the merchant to complete their purchase.

### Current Markets
- **Georgia** (GE) — GEL (₾)
- **Armenia** (AM) — AMD (֏)
- **Azerbaijan** (AZ) — AZN (₼)

The architecture is global-ready — adding new markets, languages, currencies, or merchants doesn't require rewriting core application logic.

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Fastify, TypeScript
- **Database**: PostgreSQL 16
- **Local Development**: Docker Compose
- **Testing**: Vitest

## Architecture

### Provider Abstraction
```
ProductProvider (interface)
├── AmazonProvider
├── TemuProvider
├── AliExpressProvider
└── EbayProvider
```

All merchant-specific logic is encapsulated in providers. The core application uses a common interface to search and retrieve products.

### Data Model
- **Market** — Country, locale, language, currency
- **Category** — Hierarchical product categories
- **Merchant** — External merchant (Amazon, Temu, etc.)
- **Product** — Canonical product (e.g., "Sony WH-1000XM5")
- **Offer** — Merchant-specific offer for a product (price, availability, shipping, URL)

### AI Search Abstraction
```
SearchIntentParser (interface)
└── MockSearchIntentParser (deterministic, no external LLM)
```

Parses natural language queries into structured search intent. Ready for future LLM integration.

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development without Docker)

### Quick Start with Docker

```bash
# Clone and navigate to project
cd byb

# Copy environment file
cp .env.example .env

# Start all services
docker compose up --build
```

Services will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Start PostgreSQL (you need a running instance)
# Update DATABASE_URL in .env

# Build shared package
npm run build --workspace=shared

# Start backend (terminal 1)
npm run dev:backend

# Start frontend (terminal 2)
npm run dev:frontend
```

## Project Structure

```
byb/
├── docker/
│   └── init-db/          # Database initialization scripts
├── shared/               # Shared types (Zod schemas)
│   └── src/
├── backend/
│   ├── src/
│   │   ├── config/       # Environment, database, logger
│   │   ├── modules/
│   │   │   ├── market/   # Market management
│   │   │   ├── product/  # Product & offer management
│   │   │   ├── merchant/ # Merchant management
│   │   │   ├── provider/ # Provider abstraction + mock providers
│   │   │   ├── search/   # Search orchestration
│   │   │   └── ai/       # AI search intent parser
│   │   └── shared/       # Errors, utilities
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # React components
│   │   ├── lib/          # API client, utilities
│   │   ├── hooks/        # Custom React hooks
│   │   └── types/        # Frontend-specific types
│   └── public/
└── docker-compose.yml
```

## API Endpoints

### Health
- `GET /api/health` — Service health check

### Markets
- `GET /api/markets` — List all active markets
- `GET /api/markets/:code` — Get market by code

### Merchants
- `GET /api/merchants` — List all active merchants
- `GET /api/merchants/:code` — Get merchant by code

### Search
- `GET /api/search?q=<query>&market=<code>&page=<n>&limit=<n>&sort=<type>` — Search products
- `GET /api/search/suggestions?q=<query>&market=<code>` — Search suggestions

### Products
- `GET /api/products/search` — Search with filters (same as /api/search)
- `GET /api/products/:id?market=<code>` — Get product with all offers

## Phase 0 Features

✅ **Implemented**
- Multi-market support (GE, AM, AZ)
- Provider abstraction with 4 mock providers
- Product/offer normalization and grouping
- Natural language search intent parsing (mock)
- REST API with validation
- Next.js frontend with search, results, product detail
- Market selector with currency localization
- Price comparison across merchants
- Docker Compose local development

🚫 **Not Implemented (Future Phases)**
- Real merchant API integrations
- AI/LLM-powered search (Ollama, etc.)
- User accounts, saved products, alerts
- Affiliate click tracking
- Browser extension, mobile apps
- Trending/popular algorithms
- IP-based geolocation
- Payment processing, order fulfillment

## Development

### Commands

```bash
# Run all tests
npm test

# Run backend tests only
npm run test --workspace=backend

# Lint all packages
npm run lint

# Type-check all packages
npm run typecheck

# Build all packages
npm run build

# Empty database initialization: see production deployment below.
```

### Adding a New Market

1. Add market to `docker/init-db/01-schema.sql`
2. Add locale/language/currency to shared types if new
3. No code changes needed — markets are data-driven

### Adding a New Merchant Provider

1. Implement `ProductProvider` interface in `backend/src/modules/provider/mock/`
2. Register in `backend/src/index.ts`
3. Add merchant to database seed
4. No changes to search logic or frontend needed

## Environment Variables

See `.env.example` for all configuration options.

Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXT_PUBLIC_API_URL` — Backend API URL (frontend)
- `FRONTEND_URL` — Frontend URL (backend CORS)

## License

MIT
## Minimal production deployment (usectl)

Keep this repository and its three npm workspaces together. Build two workloads
from the **repository root**; provision PostgreSQL 16 separately on a private
network with persistent storage. Local Compose and `Dockerfile.dev` remain for
local development only.

### Images and configuration

```sh
docker build -f frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.invalid -t byb-frontend:production-check .
docker build -f backend/Dockerfile -t byb-backend:production-check .
```

The example API hostname is a validation placeholder, not a deployment endpoint.
Use the actual public HTTPS backend origin when building the deployed frontend.
`NEXT_PUBLIC_API_URL` is public **build-time** configuration baked into browser
JavaScript. Missing, non-HTTPS, localhost, or non-origin production values fail
configuration validation. Changing the backend URL requires rebuilding frontend.
Do not supply secrets as build arguments.

| Workload | Variable | Purpose |
| --- | --- | --- |
| Frontend build | `NEXT_PUBLIC_API_URL` | Public HTTPS backend origin, without trailing slash/path |
| Frontend runtime | `NODE_ENV` | `production` (image default) |
| Frontend runtime | `PORT` | HTTP listener, default 3000 |
| Backend runtime | `NODE_ENV` | `production` (image default) |
| Backend runtime | `PORT` | HTTP listener, default 3001 |
| Backend runtime | `DATABASE_URL` | Secret PostgreSQL connection URI, supplied through usectl secrets |
| Backend runtime | `FRONTEND_URL` | Exact public HTTPS frontend origin, without trailing slash/path |
| Backend runtime | `LOG_LEVEL` | Optional logging verbosity |
| Self-managed PostgreSQL | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Provisioning configuration; password is secret |

Image commands (no development watchers):
- Frontend, working directory `/app/frontend`: `node ../node_modules/next/dist/bin/next start --hostname 0.0.0.0`
- Backend, working directory `/app`: `node backend/dist/index.js`

Both production images use Node 22 and run as the non-root `node` user. Configure usectl service ports to
match `PORT`. Production CORS permits only `FRONTEND_URL`; development keeps the
localhost convenience origin. CORS is browser policy, not API authentication.

### Initialize an EMPTY PostgreSQL database, once

Provision the private persistent database first. From a trusted machine with
`psql` and this repository, supply `DATABASE_URL` through your secret environment.
Verify the target database name privately before running anything. Check for user
relations (including tables, views and sequences outside system schemas):

```sh
psql -X --dbname="$DATABASE_URL" --set=ON_ERROR_STOP=1 --command="SELECT count(*) AS user_relations FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','v','m','S','f');"
```

Proceed **only when this count is zero**, no other application is using the
new database, and no other initialization is running. Then execute:

```sh
psql -X --dbname="$DATABASE_URL" --set=ON_ERROR_STOP=1 --single-transaction \
  --command="DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','v','m','S','f')) THEN RAISE EXCEPTION 'Initialization requires an empty database'; END IF; END; \$\$;" \
  --file=docker/init-db/01-schema.sql
```

The initialization role must be allowed to create the `uuid-ossp` extension and
schema objects. This command rechecks emptiness within the transaction and creates
the existing schema and reference markets/categories/merchants.
It does not seed real merchant inventory. The SQL is **not rerunnable**: table
creation is not idempotent. Do not use it to upgrade, reset or repair an existing
database. A failed invocation rolls back the whole transaction. Keep connection
URIs out of shell history/logs and use a trusted machine (command arguments may
be visible to other privileged users). The broken migration/seed npm commands
have been removed; no migration framework is claimed or added. Application
startup never initializes or resets the database. Future schema changes require
explicit reviewed migrations and backups.

### Networking, health and deployment order

1. Provision PostgreSQL privately with persistent storage and backups; initialize
   the empty database once. Configure provider-required TLS through `DATABASE_URL`.
2. Establish public HTTPS frontend/backend domains. Configure backend secrets,
   `FRONTEND_URL`, and its internal listening port; deploy backend.
3. Build frontend using the backend public HTTPS origin and deploy frontend.
4. Verify browser requests, CORS, themes, search/Concierge, and product navigation.

Expose frontend HTTPS publicly and backend HTTPS publicly (the browser calls
backend directly). PostgreSQL must have **no public listener/ingress**; only backend
and authorized administration should reach it. Frontend never connects to
PostgreSQL. Do not use localhost as any production service destination.

Backend readiness: HTTP `GET /health` on port 3001 (or configured `PORT`), success
HTTP 200 only when PostgreSQL responds; unavailable database returns sanitized
HTTP 503. Allow at least 10 seconds for each probe (DB connect timeout is 5 seconds).
Frontend: HTTP `GET /` on port 3000, expect HTTP 200. Use readiness rather than
restarting backend continually during database outages. Allow at least 30 seconds
for container termination: SIGTERM/SIGINT await request draining then pool close.

Persistent volumes/addon lifecycle must survive workload replacement. Never delete
or recreate a populated database to redeploy BYB. Configure and verify backups and
restore procedures before accepting important data. This MVP still uses mock
providers; production deployment does not make those offers real merchant data.

## eBay Marketplace Account Deletion compliance

Production GET/POST endpoint:
`https://byb-backend.usectl.com/api/ebay/account-deletion`

Set the backend runtime secret `EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN=<secret>`.
Generate a token with 32–80 alphanumeric/underscore/hyphen characters; never put
its value in Git or frontend variables. Missing/empty configuration leaves the
application working but the endpoint returns 503. Configured invalid tokens fail
validation. Previous EBAY_ACCOUNT_DELETION_* and client credential settings are
not used by this token-only implementation.

GET requires exactly one nonempty `challenge_code` and returns HTTP 200 JSON with
`challengeResponse`: lowercase SHA-256 hex over UTF-8 challenge code + token +
the exact production endpoint above, with no separators or trailing slash.
Host/forwarded headers never influence this URL. Invalid challenges return 400.

POST accepts bounded (64 KiB) JSON account-deletion envelopes and returns 204.
Malformed requests return 400, oversized bodies 413, unsupported content types 415.
Duplicates are safe. No payloads/account identifiers are stored or logged; only a
receipt outcome is logged. Current BYB stores public product/listing/offer data,
not eBay account identifiers, buyer details, user tokens or account mappings.
Therefore this handler deletes nothing: products, offers and merchants stay intact.

This is receipt acknowledgement ONLY: POST sender authenticity is not verified.
The verification token proves endpoint ownership during GET, not POST authenticity.
eBay's official guide also describes notification signature verification. OAuth
and signature-key retrieval are intentionally outside this implementation; do not
use these unauthenticated receipts to drive deletion or account-related processing.
Revisit verification/deletion handling before storing any account-related data.

After a separately authorized deployment, manually configure in eBay's Developer
portal (Application Keys → Alerts and Notifications → Marketplace Account Deletion):

- Notification endpoint: `https://byb-backend.usectl.com/api/ebay/account-deletion`
- Verification token: the SAME secret configured in the backend environment
- Alert email: your operational contact

Save to complete the GET challenge, run Send Test Notification, and confirm the
Production keyset status. Portal acceptance is not established by local tests.

Official specification:
https://developer.ebay.com/develop/guides/sell/marketplace-user-account-deletion
