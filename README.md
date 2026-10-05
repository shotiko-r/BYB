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

# Database migrations
npm run db:migrate

# Seed database
npm run db:seed
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