# Shoptics — Inventory & Accounting Management App

## Overview
Next.js 14 (App Router) inventory management and month-end accounting dashboard for Superfoods Company.
Deployed on Vercel at `shoptics.ai`, uses Supabase for auth + Postgres, Tailwind CSS throughout.

## Tech Stack
- **Framework**: Next.js 14, App Router, TypeScript (strict)
- **Database**: Supabase Postgres with RLS, `@supabase/ssr`
- **Styling**: Tailwind CSS only — no inline styles, no CSS modules
- **Charts**: Recharts
- **Icons**: Lucide React
- **Payment SDKs**: `braintree` (Node.js), PayPal REST API, Shopify Admin API
- **Push Notifications**: `web-push` with VAPID keys, service worker at `/public/sw.js`

## Key Accounts & Infra
- **GitHub**: `thecyclecoder/logistics`
- **Vercel**: `logistics` under `dylan-ralstons-projects`, domain: `shoptics.ai`
- **Supabase**: project `logistics` (ref: `ztrjpkestsymbimuqyrz`) in org `Superfoods Company`
- **Google OAuth**: configured in Supabase, redirect allowlist includes Vercel domains + localhost

## Auth Flow
- Google OAuth via Supabase
- Middleware checks session on every protected route
- `ADMIN_EMAILS` env var gates access — only listed emails get in
- Others see `/restricted`, unauthenticated → `/login`
- Public routes (no auth required): `/api/cron/*`, `/api/overview/*`, `/api/inventory-audit`, `/api/sales-data`, `/api/push/send`, `/api/qb/sync-processors`, `/api/qb/journal-entry`, `/legal/*`

## Product Model
Products come from QuickBooks. Two types:
- **Finished Goods** (QB Group items): Have a Bill of Materials (BOM) with component items
  - Example: "Superfood Tabs - Strawberry Lemonade" = 1 IFC box + 1 Tabs product
  - The BOM represents manufacturing composition, NOT retail bundles
- **Finished Goods (No BOM)**: Standalone items like ACV Gummies
- **Components / Raw Materials**: IFC boxes, bulk coffee, pods, stick packs, gussets

The `products` table has `item_type` ("inventory" or "bundle"), `bundle_id` (FK to parent), `bundle_quantity`.
Users can reclassify products via dropdown on the Products page.

### Multi-Parent BOM
Components can belong to multiple parent Groups in QuickBooks (e.g., Stick Packs OPF appears in both 30-count and 10-count Groups). The `product_bom` join table supports this many-to-many relationship. The legacy `bundle_id` on products is still maintained for backward compatibility but `product_bom` is the source of truth.

Key multi-parent components:
- Stick Packs OPF: in 30-count (×30) AND 10-count (×10)
- IFC Mixed Berry 30ct: in Mixed Berry 30-count AND Mixed Berry Expired
- Bulk Coffee Cocoa: in KCups (×0.2)

The inventory audit computes component sales burn across ALL parent Groups, and month-end adjustments deduplicate by product_id.

## Inventory Locations
- **Amazon FBA**: Only finished goods, but some SKUs are multi-packs (2-pack = 2× units). Handled via `unit_multiplier` on `sku_mappings`.
- **Amplifier (3PL)**: Finished goods + sometimes components (when co-manufacturers don't want to store them long-term)
- **QuickBooks**: Source of truth for product catalog and on-hand quantities (manual sync only)
- **Manual Inventory**: Components at co-manufacturers (e.g., stick packs at VitaQuest), tracked in `manual_inventory` table

## Integrations
All credentials stored in `integration_credentials` table (jsonb), NOT env vars.

- **QuickBooks Online**: OAuth2 with auto-rotating refresh tokens stored in `qb_tokens` table. Manual sync only (month-end closing). Production environment. Configurable account mappings via `qb_account_mappings` table.
- **Amazon SP-API**: LWA OAuth2 token refresh. Marketplace: US (ATVPDKIKX0DER). Automated via cron.
- **Shopify**: OAuth2 flow at `/api/shopify/connect`. Scopes: `read_orders,read_products,read_inventory,read_shopify_payments_payouts`. The actual store domain returned by Shopify differs from the friendly URL — always use the domain from the OAuth callback.
- **Amplifier (3PL)**: HTTP Basic Auth (API key as username, blank password). Base URL: `https://api.amplifier.com`.
- **PayPal**: OAuth2 client credentials flow. REST API for transaction search. Credentials: `client_id` + `client_secret`.
- **Braintree**: Node.js SDK + GraphQL API. Credentials: `merchant_id` + `public_key` + `private_key`. Transaction-level fee reports via GraphQL give estimated fees (~58% of actual due to missing card network assessments).

## Sync Engine
`lib/sync-engine.ts` — each function logs to `cron_logs` table.

- **Automated (cron)**: `syncAmazonInventory`, `sync3PLInventory`, `syncAmazonSales`, `syncShopifySales`
- **Manual only**: `syncQBProducts` — triggered via "Sync QuickBooks" button (month-end)
- **syncAll()**: Runs all automated syncs, excludes QB

Unmapped SKUs are tracked in `unmapped_skus` table and surfaced as alerts on the dashboard.

## Month-End Closing (7 Steps)
`/api/qb/month-end-closing` — orchestrates the full closing sequence:

1. **QB Inventory Snapshot (Pre-Closing)** — snapshots all QB inventory items
2. **Inventory Adjustment** — zeros variances via QB InventoryAdjustment to shrinkage account
3. **Amazon Sales Receipt** — $0 Sales Receipt for COGS via Group item auto-expansion
4. **Shopify Sales Receipt** — same pattern as Amazon
5. **QB Inventory Snapshot (Post-Closing)** — re-snapshots after adjustment + receipts
6. **Variance Check** — compares post-closing QB vs FBA + 3PL + Manual (should be zero)
7. **Shopify Journal Entry** — syncs processor data then creates balanced JE in QuickBooks

Key behaviors:
- `debug=true` query param bypasses date restriction and uses today's date for all QB entries
- Sales Receipts use GroupLineDetail for bundles (QB auto-expands BOM components for COGS)
- DocNumber format: `AMZ-MM-YYYY`, `SHOP-MM-YYYY`, `SHOPIFY-MMYY`
- Won't re-run for a month that's already completed
- Push notification sent on completion

### Shopify Journal Entry
The JE records Shopify website sales revenue and payment processor activity. Amazon is handled separately by A2X.

**Revenue side (Credits)** — from Shopify orders (accrual basis):
- Product revenue grouped by QB revenue account (mapped via `revenue_account_id` on products)
- Shipping income (includes shipping protection products mapped via `shipping_protection_products` table)
- Sales tax collected
- Discounts & coupons (contra-revenue, debit side)

**Processor side** — from payment processor APIs:
- Gross clearing debits from ORDER data grouped by payment gateway (accrual basis, not payout dates)
- Fees, refunds, chargebacks from processor API data stored in `payment_processor_summaries`
- Gateway names mapped to processor categories via `gateway_mappings` table
- Categories: Shopify Payments, PayPal, Braintree, Gift Card, Walmart, Other

**Braintree fees caveat**: API provides estimated fees (~58% of actual). Card network assessments aren't available until the monthly statement (~5th of month). The month-end page has an editable Braintree fees field to override with actual value and update the JE in QuickBooks.

**Balance**: Total debits MUST equal total credits. Auto-balances with rounding adjustment line if needed (<$1).

### Payment Processor Data Sources
| Processor | Gross | Fees | Refunds | Chargebacks |
|---|---|---|---|---|
| Shopify Payments | Payout summaries | `charges_fee_amount` | `refunds_gross_amount` | `adjustments_gross_amount` (disputes) |
| PayPal | T0003+T0006 | `fee_amount` on sales | T1107 | T1201+T1106 |
| Braintree | Transaction search | GraphQL `transactionLevelFees` (est.) | Transaction search (credits) | Dispute search |

### QB Account Mappings
Configurable via Connections → QuickBooks → Account Mappings. Grouped by:

**Month-End Closing**: Shrinkage Account, Amazon/Shopify Customer, Amazon/Shopify Deposit Account
**Journal Entry**: Discounts & Coupons, Sales Tax Payable, Shipping Income, Chargebacks, Refunds, Gift Card Liability, Shopify Other Adjustments
**Payment Processors**: Shopify/PayPal/Braintree/Walmart Clearing + Transaction Fees accounts

All select dropdowns are searchable (SearchableSelect component).

## Vercel Crons
- `/api/cron/inventory` — every 6 hours (`0 */6 * * *`)
- `/api/cron/sales` — daily at 2am UTC
- `/api/cron/3pl-snapshot` — daily at 12:01am UTC
- `/api/cron/amazon-sales` — daily at 6:30am UTC
- `/api/cron/shopify-sales` — daily at 7am UTC
- `/api/cron/processor-snapshot` — daily at 8am UTC (Shopify Payments, PayPal, Braintree)
- `/api/cron/notifications` — daily at 1pm UTC (9am Eastern)
- Protected by `CRON_SECRET` Bearer token

## Push Notifications
Daily at 9am Eastern, checks for:
1. **Low stock** — products with <3 months runway (based on 14-day sales burn)
2. **FBA replenishment** — ASINs with <14 days stock
3. **Month-end closing reminder** — fires from 1st of month until previous month is closed
4. **Unmapped SKUs** — new unmapped entries detected
5. **Missing snapshots** — FBA or 3PL snapshot didn't run today
6. **Month-end completion** — sent when closing finishes (pass/fail)

Subscriptions stored per-device (`user_id` + `device_id` from SHA-256 of user-agent). Supports multiple devices (browser + mobile PWA).

## Database Schema
Tables: `products`, `product_bom`, `sku_mappings`, `inventory_snapshots`, `amazon_inventory_snapshots`, `tpl_inventory_snapshots`, `amazon_sales_snapshots`, `shopify_sales_snapshots`, `sale_records`, `cron_logs`, `qb_tokens`, `shopify_tokens`, `unmapped_skus`, `integration_credentials`, `manual_inventory`, `external_skus`, `month_end_closings`, `qb_account_mappings`, `gateway_mappings`, `shipping_protection_products`, `payment_processor_summaries`, `push_subscriptions`

All tables have RLS enabled. Migrations in `supabase/migrations/` (028 migrations).

## Pages
- `/login` — Google OAuth sign-in
- `/restricted` — access denied page
- `/dashboard` — overview with stats, revenue chart, low stock alerts, FBA replenishment, sync history
- `/dashboard/products` — finished goods with multi-parent BOM, standalone, components (editable categorization)
- `/dashboard/inventory` — inventory table with FBA/3PL/QB columns, variance tracking
- `/dashboard/sales` — month selector, channel breakdown, per-product table with ASP/COGS/margin
- `/dashboard/mapping` — SKU mapping CRUD with source filters, unit multiplier
- `/dashboard/sync` — per-job status cards + full history table
- `/dashboard/month-end` — 7-step closing flow with JE preview/edit card
- `/dashboard/revenue-mapping` — assign QB revenue accounts to products + shipping
- `/dashboard/connections` — hub for all integrations
- `/dashboard/connections/quickbooks` — QB sync, account mappings (searchable selects, grouped)
- `/dashboard/connections/shopify` — Shopify sync, gateway mapping, shipping protection products
- `/dashboard/connections/amazon` — Amazon connection
- `/dashboard/connections/amplifier` — 3PL connection + inventory review
- `/dashboard/connections/paypal` — PayPal credentials (client_id + secret)
- `/dashboard/connections/braintree` — Braintree credentials (merchant_id + keys)
- `/legal/eula` and `/legal/privacy` — required for QuickBooks app

## API Routes
- `POST /api/sync/all` — trigger all automated syncs
- `POST /api/sync/quickbooks` — trigger QB sync only
- `GET /api/cron/*` — Vercel crons (inventory, sales, 3pl, amazon-sales, shopify-sales, processor-snapshot, notifications)
- `GET /api/overview/low-stock` — low stock alerts
- `GET /api/overview/fba-replenishment` — FBA replenishment alerts
- `GET /api/inventory-audit` — full inventory reconciliation
- `GET /api/sales-data` — aggregated sales by product with COGS/margin
- `GET/POST/PATCH /api/mappings` — SKU mapping CRUD
- `PATCH /api/products/[id]` — update product categorization
- `GET /api/qb/connect` — start QB OAuth flow
- `GET /api/qb/callback` — QB OAuth callback
- `POST /api/qb/disconnect` — revoke QB tokens (POST, not GET — prevents prefetch deletion)
- `GET/POST /api/qb/account-mappings` — configurable QB account/customer mappings
- `GET/POST /api/qb/revenue-accounts` — revenue account options + product mappings
- `POST /api/qb/month-end-closing` — 7-step closing flow
- `GET /api/qb/month-end-closing/history` — past closings
- `POST /api/qb/sync-processors` — sync Shopify Payments, PayPal, Braintree data
- `GET/POST /api/qb/journal-entry` — preview or create/update Shopify JE in QB
- `POST /api/qb/sales-receipt` — create sales receipt for a channel/month
- `GET /api/shopify/connect` — start Shopify OAuth flow
- `GET/POST /api/gateway-mappings` — map Shopify gateway names to processor categories
- `GET/POST/DELETE /api/shipping-protection` — manage shipping protection product mappings
- `POST /api/connections/credentials` — save integration credentials
- `POST /api/push/send` — send push notification (protected by PUSH_SECRET)
- `POST /api/push/subscribe` — register push subscription
- `GET /api/push/check` — check subscription status (per-device with `per_device=true`)

## Pre-Push Checklist (MANDATORY)
Every change must go through this sequence before considering it done:
1. **TypeScript check**: `npx tsc --noEmit` — fix all type errors
2. **Lint + Build**: `npm run build` — this runs ESLint and builds. Fix all lint errors (unused vars, imports, etc.)
3. **Commit & Push**: `git add`, `git commit`, `git push origin main`
4. **Verify deployment**: `sleep 60 && vercel ls` — confirm the latest deploy status is "Ready"
5. **If deploy fails**: check logs with `vercel inspect <url> --logs`, fix issues, re-push, and repeat from step 1

Common gotchas:
- Unused variables/imports cause ESLint errors that fail the Vercel build
- `[...new Set()]` doesn't work — use `Array.from(new Set())`
- Supabase `qb_tokens` and `shopify_tokens` tables require `createServiceClient()` (service role) not `createClient()` (user session) due to RLS
- Shopify/QB OAuth redirect URIs must use `NEXT_PUBLIC_SITE_URL` or hardcoded production domain, NOT `request.url` (Vercel deployment URLs don't match app config)
- `.eq("active", true)` Supabase boolean filter returns 0 rows on deployed Vercel — always filter active in JS instead
- QB disconnect endpoint must be POST (not GET) — Next.js prefetches `<a href>` links

## Development Notes
- Data fetching in server components where possible, client components only for interactivity
- `revalidate = 60` on dashboard pages, `revalidate = 0` on mapping and products pages
- All monetary values stored as `numeric(12,4)` in Postgres
- QB refresh tokens auto-rotate and are stored in `qb_tokens` table
- Shopify tokens stored in `shopify_tokens` table (shop_domain + access_token)
- `createServiceClient()` wraps fetch with `cache: "no-store"` to prevent Vercel caching of Supabase responses
- All API routes that fetch data use `export const dynamic = "force-dynamic"` to prevent Next.js static caching
- QB images downloaded to Supabase Storage as 400x400 webp (TempDownloadUri URLs expire)
- Amazon sales bucketing uses `promotion-ids` field from order reports
- Shopify subscription bucketing uses `source_name` and `tags` fields
