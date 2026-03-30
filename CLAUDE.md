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

## FBA Replenishment Workflow (TO BUILD)

End-to-end automated replenishment from Amplifier (3PL) to Amazon FBA. Currently a manual multi-platform process.

### The Replenishment Chain
```
Low FBA stock detected for ASIN (e.g., B0XXXX - ST Mixed Berry 2-pack)
  → Check if Amplifier has assembled kits ready (e.g., ST-MB-2PK)
    → If not, create kitting order at Amplifier:
        - Take 100× single units (ST-MB-1)
        - Assemble into 50× 2-packs
        - Apply Transparency sticker to each unit
    → Once kits are ready, ship to Amazon FBA:
        - Create inbound plan via Amazon SP-API
        - Amazon assigns fulfillment center (e.g., PHX5)
        - Create outbound order at Amplifier → ship to PHX5
        - Poll for tracking → push to Amazon
        - Monitor receiving at Amazon FC
```

### Key Mappings Needed (New Tables)
- **ASIN → Amplifier Kit SKU**: Which kit at Amplifier fulfills this ASIN (e.g., B0XXXX → ST-MB-2PK)
- **Kit SKU → Components**: What goes into the kit (e.g., ST-MB-2PK = 2× ST-MB-1 + 1× Transparency sticker)
- **ASIN → Transparency enrollment**: Does this ASIN need Transparency codes? If yes, generate via Amazon Transparency API before kitting
- **Unit multiplier**: A 2-pack ASIN means 2 units per kit, so shipping 50 kits = 100 units on the listing

### Amazon SP-API: Fulfillment Inbound v2024-03-20
Use the NEW v2024 API (v0 was deprecated Dec 2024). The workflow is sequential and asynchronous (operations return `operationId` to poll for status).

**Phase 1 — Plan & Pack:**
1. `POST /inbound/fba/2024-03-20/inboundPlans` — create plan with source address, items (MSKU, qty)
2. `POST .../packingOptions/generate` → `PUT .../packingOptions/confirm` — packing arrangement
3. `PUT .../shipments/{id}/packingInformation` — box dimensions, weight, contents

**Phase 2 — Placement:**
4. `POST .../placementOptions/generate` — get FC destination options + fees
5. `PUT .../placementOptions/confirm` — confirms FC assignment, creates shipment confirmation IDs

**Phase 3 — Transportation:**
6. `POST .../transportationOptions/generate` — get carrier quotes
7. `GET .../transportationOptions` — review options
8. `POST .../deliveryWindowOptions/generate` + `PUT .../confirm` — for LTL/FTL only
9. `PUT .../transportationOptions/confirm` — finalize carrier

**Phase 4 — Ship & Track:**
10. `GET .../labels` — generate FBA box ID labels (required on every box)
11. `PUT .../trackingDetails` — push tracking number after 3PL ships (carrier, PRO/BOL number)
12. Poll shipment status for receiving confirmation

### Amplifier API Integration
- **Create kitting order**: `POST /orders` with kit assembly instructions + destination = Amplifier warehouse (internal)
- **Create outbound order**: `POST /orders` with kit SKU + destination = Amazon FC address from step 5
- **Poll for tracking**: `GET /reports/shipments/{date}` via daily cron — match against pending inbound plans
- **Inventory check**: `GET /reports/inventory/current` — check if assembled kits are in stock before creating FBA shipment
- **No webhooks available** — must poll for shipment status updates

### Amazon Transparency API
- Look up which ASINs are enrolled in Transparency program
- Generate Transparency codes programmatically
- Provide codes to Amplifier for sticker application during kitting
- Each unit needs a unique code — generate batch of codes before kitting order

### Proposed UI: `/dashboard/replenishment`
1. **Replenishment Queue** — ASINs needing stock (from existing FBA replenishment alerts), showing:
   - Current FBA stock, burn rate, days of stock remaining
   - Kit SKU at Amplifier and current kit inventory
   - Whether kitting is needed first
   - Suggested ship quantity

2. **Kit Mapping Config** — map each ASIN to its Amplifier Kit SKU:
   - ASIN → Kit SKU → Component SKUs + quantities
   - Transparency enrollment flag
   - Unit multiplier (how many units per kit)

3. **One-Click Actions**:
   - "Build Kits" → creates kitting order at Amplifier (with Transparency codes if needed)
   - "Ship to FBA" → creates Amazon inbound plan + Amplifier outbound order
   - Status tracker showing pipeline: Kitting → Ready → Shipped → In Transit → Received

4. **Shipment History** — past replenishments with status, quantities, tracking

### Proposed API Routes
- `GET /api/replenishment/queue` — ASINs needing replenishment with kit status
- `POST /api/replenishment/create-kit-order` — trigger kitting at Amplifier
- `POST /api/replenishment/create-inbound` — create Amazon inbound plan
- `POST /api/replenishment/ship` — create Amplifier outbound order to Amazon FC
- `PUT /api/replenishment/update-tracking` — push tracking to Amazon
- `GET /api/replenishment/status` — check inbound shipment status
- `GET /api/cron/replenishment-tracking` — poll Amplifier for tracking updates

### Future: AI Case Management
- Monitor receiving discrepancies (shipped 500, received 480)
- Auto-draft Seller Support cases with shipment details, tracking, BOL
- Use Claude API to generate case responses based on discrepancy type
- Auto-respond to Amazon follow-up questions
- Amazon SP-API has Messaging API and Case Management endpoints

### FBA Capacity Limits (IMPORTANT)
Amazon does NOT expose FBA capacity/restock limits via the SP-API. No endpoint exists — open feature request since 2022, still unimplemented. Sellers must check Seller Central's "FBA Capacity Manager" manually.

**Impact on replenishment flow:**
- Cannot programmatically check remaining capacity before creating shipments
- Amazon returns 400 error if shipment would exceed capacity (only way to know)
- Must implement manual capacity entry: user inputs their limit from Seller Central
- Store as snapshots to track fluctuations over time
- Calculate remaining: `capacity_limit - current_fba_inventory - inbound_shipments`
- Gate the replenishment UI: don't allow creating shipments that would exceed entered limit
- Catch and surface 400 errors gracefully if limit is exceeded despite checks

**What IS available via API:**
- Current FBA inventory levels (`getInventorySummaries`)
- Inbound/in-transit quantities
- Shipment creation (will fail if over limit, but no pre-check)

### Key Constraints
- Max 1500 SKUs per inbound plan
- SPD parcels: <15kg each
- All units need FNSKU label (not UPC) — generated via `getLabels` API
- Every shipping box needs unique FBA box ID label
- Multiple expiration dates require separate inbound plans
- Cancellation window: 24h for SPD, 1h for LTL/FTL
- All async operations need polling via `getInboundOperationStatus`

## Amazon Margin Analysis
Page at `/dashboard/amazon` showing per-product profitability after Amazon fees.

Data from Amazon SP-API Finances API (`/finances/v0/financialEventGroups`):
- Per-item: Principal (revenue), Tax, FBAPerUnitFulfillmentFee, Commission (referral), Promotions
- Aggregated by product (mapped via seller_sku → ASIN → product_id)
- Two margin calculations: pre-COGS (after Amazon fees) and post-COGS (true profit)
- Products with missing BOM costs flagged as incomplete

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
