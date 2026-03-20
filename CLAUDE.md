# Logistics — Inventory Management App

## Overview
Next.js 14 (App Router) inventory management dashboard for Superfoods Company.
Deployed on Vercel, uses Supabase for auth + Postgres, Tailwind CSS throughout.

## Tech Stack
- **Framework**: Next.js 14, App Router, TypeScript (strict)
- **Database**: Supabase Postgres with RLS, `@supabase/ssr`
- **Styling**: Tailwind CSS only — no inline styles, no CSS modules
- **Charts**: Recharts
- **Icons**: Lucide React
- **Validation**: Zod on all API inputs

## Key Accounts & Infra
- **GitHub**: `thecyclecoder/logistics`
- **Vercel**: `logistics` under `dylan-ralstons-projects`, domain: `logistics-beige-seven.vercel.app`
- **Supabase**: project `logistics` (ref: `ztrjpkestsymbimuqyrz`) in org `Superfoods Company`
- **Google OAuth**: configured in Supabase, redirect allowlist includes Vercel domains + localhost

## Auth Flow
- Google OAuth via Supabase
- Middleware checks session on every protected route
- `ADMIN_EMAILS` env var gates access — only listed emails get in
- Others see `/restricted`, unauthenticated → `/login`

## Product Model
Products come from QuickBooks. Two types:
- **Finished Goods** (QB Group items): Have a Bill of Materials (BOM) with component items
  - Example: "Superfood Tabs - Strawberry Lemonade" = 1 IFC box + 1 Tabs product
  - The BOM represents manufacturing composition, NOT retail bundles
- **Finished Goods (No BOM)**: Standalone items like ACV Gummies
- **Components / Raw Materials**: IFC boxes, bulk coffee, pods — only exist as parts of finished goods

The `products` table has `item_type` ("inventory" or "bundle"), `bundle_id` (FK to parent), `bundle_quantity`.
Users can reclassify products via dropdown on the Products page.

## Inventory Locations
- **Amazon FBA**: Only finished goods, but some SKUs are multi-packs (2-pack = 2× units). Handled via `unit_multiplier` on `sku_mappings`.
- **Amplifier (3PL)**: Finished goods + sometimes components (when co-manufacturers don't want to store them long-term)
- **QuickBooks**: Source of truth for product catalog and on-hand quantities (manual sync only)
- **In-Transit**: Units shipped Amplifier → Amazon that have left 3PL but not yet received at FBA (future feature)

## Integrations
- **QuickBooks Online**: OAuth2 with auto-rotating refresh tokens stored in `qb_tokens` table. Manual sync only (month-end closing). Production environment.
- **Amazon SP-API**: LWA OAuth2 token refresh. Marketplace: US (ATVPDKIKX0DER). Automated via cron.
- **Shopify**: OAuth2 flow at `/api/shopify/connect`. Important: the actual store domain returned by Shopify differs from the friendly URL — always use the domain from the OAuth callback.
- **Amplifier (3PL)**: HTTP Basic Auth (API key as username, blank password). Base URL: `https://api.amplifier.com`. Endpoints: `/reports/inventory/current`, `/orders`, `/reports/shipments/{yyyymmdd}`, `/items/`.

## Sync Engine
`lib/sync-engine.ts` — each function logs to `cron_logs` table.

- **Automated (cron)**: `syncAmazonInventory`, `sync3PLInventory`, `syncAmazonSales`, `syncShopifySales`
- **Manual only**: `syncQBProducts` — triggered via "Sync QuickBooks" button (month-end)
- **syncAll()**: Runs all automated syncs, excludes QB

Unmapped SKUs are tracked in `unmapped_skus` table and surfaced as alerts on the dashboard.

## Vercel Crons
- `/api/cron/inventory` — every 6 hours (`0 */6 * * *`)
- `/api/cron/sales` — daily at 2am UTC (`0 2 * * *`)
- Protected by `CRON_SECRET` Bearer token

## Database Schema
Tables: `products`, `sku_mappings`, `inventory_snapshots`, `sale_records`, `cron_logs`, `qb_tokens`, `unmapped_skus`
Views: `current_inventory`, `monthly_sales_summary`
All tables have RLS enabled. Migrations in `supabase/migrations/`.

## Pages
- `/login` — Google OAuth sign-in
- `/restricted` — access denied page
- `/dashboard` — overview with stats, revenue chart, alerts, sync buttons
- `/dashboard/products` — finished goods with BOM, standalone, components (editable categorization)
- `/dashboard/inventory` — inventory table with FBA/FBM/3PL/QB columns, QB delta, status badges
- `/dashboard/sales` — month selector, channel breakdown, per-product table
- `/dashboard/mapping` — SKU mapping CRUD with source filters, unit multiplier, unmapped products section
- `/dashboard/sync` — per-job status cards + full history table
- `/legal/eula` and `/legal/privacy` — required for QuickBooks app

## API Routes
- `POST /api/sync/all` — trigger all automated syncs
- `POST /api/sync/quickbooks` — trigger QB sync only
- `GET /api/cron/inventory` — Vercel cron, inventory syncs
- `GET /api/cron/sales` — Vercel cron, sales syncs
- `GET /api/dashboard/revenue-chart` — last 6 months revenue by channel
- `GET/POST/PATCH /api/mappings` — SKU mapping CRUD
- `DELETE /api/mappings/[id]` — soft delete mapping
- `PATCH /api/products/[id]` — update product categorization
- `GET /api/unmapped-skus` — list unmapped SKUs
- `DELETE /api/unmapped-skus/[id]` — dismiss unmapped SKU
- `GET /api/qb/connect` — start QB OAuth flow
- `GET /api/qb/callback` — QB OAuth callback (stores tokens in DB)
- `GET /api/qb/disconnect` — revoke QB tokens
- `GET /api/shopify/connect` — start Shopify OAuth flow
- `GET /api/shopify/callback` — Shopify OAuth callback
- `GET /auth/callback` — Supabase Google OAuth callback

## Development Notes
- Data fetching in server components where possible, client components only for interactivity
- `revalidate = 60` on dashboard pages, `revalidate = 0` on mapping and products pages
- All monetary values stored as `numeric(12,4)` in Postgres
- QB refresh tokens auto-rotate and are stored in `qb_tokens` table
