# Amazon Order Bucketing: Recurring vs One-Time vs SNS Checkout

## Overview
Method to categorize Amazon orders into 3 buckets:
1. **Recurring** — Auto-shipped Subscribe & Save orders (passive revenue)
2. **SNS Checkout** — Customer chose SNS at checkout (first-time subscription)
3. **One-Time Checkout** — Regular purchase, no subscription

## Why the Standard Orders API Doesn't Work
The SP-API Orders endpoint (`/orders/v0/orders`) does NOT expose SNS/subscription flags.
- All orders show as `OrderType: "StandardOrder"`
- No `IsSubscriptionOrder` or similar field exists
- Order items also don't have subscription flags

## Solution: Use the Reports API
The flat file orders report includes a `promotion-ids` field that identifies SNS orders.

### Report Type
`GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL`

### Key Field: `promotion-ids`
| Value | Bucket |
|---|---|
| `FBA Subscribe & Save Discount` | **Recurring** (auto-shipped on schedule) |
| `Subscribe and Save Promotion V2` | **SNS Checkout** (first-time SNS signup) |
| Empty or other values | **One-Time Checkout** |

## Full Implementation

### Step 1: Amazon LWA OAuth2 Token
```javascript
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json();
  return data.access_token;
}
```

### Step 2: Request the Report
```javascript
const SP_API_BASE = "https://sellingpartnerapi-na.amazon.com";

async function requestOrderReport(token, startDate, endDate) {
  const res = await fetch(`${SP_API_BASE}/reports/2021-06-30/reports`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-amz-access-token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reportType: "GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL",
      marketplaceIds: ["ATVPDKIKX0DER"], // US marketplace
      dataStartTime: startDate, // ISO string
      dataEndTime: endDate,     // ISO string, must be 2+ min before now
    }),
  });
  const data = await res.json();
  return data.reportId; // e.g., "350527020533"
}
```

### Step 3: Poll for Report Completion
```javascript
async function waitForReport(token, reportId) {
  let status = "IN_PROGRESS";
  let docId = null;

  while (status === "IN_PROGRESS" || status === "IN_QUEUE") {
    await new Promise((r) => setTimeout(r, 5000)); // wait 5 sec

    const res = await fetch(
      `${SP_API_BASE}/reports/2021-06-30/reports/${reportId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
        },
      }
    );
    const data = await res.json();
    status = data.processingStatus;
    docId = data.reportDocumentId;
  }

  return docId; // null if report failed
}
```

### Step 4: Download the Report
```javascript
async function downloadReport(token, documentId) {
  // Get download URL
  const docRes = await fetch(
    `${SP_API_BASE}/reports/2021-06-30/documents/${documentId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-amz-access-token": token,
      },
    }
  );
  const docData = await docRes.json();

  // Download the TSV file
  const reportRes = await fetch(docData.url);
  return await reportRes.text();
}
```

### Step 5: Parse and Bucket
```javascript
function parseAndBucket(reportTSV) {
  const lines = reportTSV.split("\n");
  const headers = lines[0].split("\t");

  const promoIdx = headers.indexOf("promotion-ids");
  const orderIdIdx = headers.indexOf("amazon-order-id");
  const skuIdx = headers.indexOf("sku");
  const asinIdx = headers.indexOf("asin");
  const qtyIdx = headers.indexOf("quantity");
  const priceIdx = headers.indexOf("item-price");
  const dateIdx = headers.indexOf("purchase-date");

  const buckets = {
    recurring: [],    // FBA Subscribe & Save Discount
    sns_checkout: [], // Subscribe and Save Promotion V2
    one_time: [],     // everything else
  };

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split("\t");

    const promoIds = cols[promoIdx] || "";
    const order = {
      orderId: cols[orderIdIdx],
      sku: cols[skuIdx],
      asin: cols[asinIdx],
      quantity: parseInt(cols[qtyIdx]) || 0,
      price: parseFloat(cols[priceIdx]) || 0,
      date: cols[dateIdx],
      promoIds: promoIds,
    };

    if (promoIds.includes("FBA Subscribe & Save Discount")) {
      buckets.recurring.push(order);
    } else if (promoIds.includes("Subscribe and Save Promotion V2")) {
      buckets.sns_checkout.push(order);
    } else {
      buckets.one_time.push(order);
    }
  }

  return buckets;
}
```

### Step 6: Complete Example
```javascript
async function analyzeOrders(clientId, clientSecret, refreshToken, days = 7) {
  const token = await getAccessToken(clientId, clientSecret, refreshToken);

  const endDate = new Date(Date.now() - 3 * 60 * 1000).toISOString(); // 3 min ago
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Request report
  const reportId = await requestOrderReport(token, startDate, endDate);
  console.log("Report requested:", reportId);

  // Wait for completion
  const docId = await waitForReport(token, reportId);
  if (!docId) throw new Error("Report failed");

  // Download and parse
  const reportText = await downloadReport(token, docId);
  const buckets = parseAndBucket(reportText);

  // Summary
  const total = buckets.recurring.length + buckets.sns_checkout.length + buckets.one_time.length;
  console.log(`\nTotal line items: ${total}`);
  console.log(`Recurring (auto-shipped SNS): ${buckets.recurring.length} (${(buckets.recurring.length/total*100).toFixed(1)}%)`);
  console.log(`SNS Checkout (first-time): ${buckets.sns_checkout.length} (${(buckets.sns_checkout.length/total*100).toFixed(1)}%)`);
  console.log(`One-Time Checkout: ${buckets.one_time.length} (${(buckets.one_time.length/total*100).toFixed(1)}%)`);

  return buckets;
}
```

## Report Columns Available
The report includes these columns (tab-separated):
- `amazon-order-id` — unique order ID
- `purchase-date` — ISO timestamp
- `order-status` — Shipped, Shipping, etc.
- `fulfillment-channel` — "Amazon" for FBA
- `sales-channel` — "Amazon.com" or "Non-Amazon"
- `product-name` — product title
- `sku` — seller SKU
- `asin` — Amazon ASIN
- `quantity` — units ordered
- `item-price` — price in USD
- `item-tax` — tax amount
- `shipping-price` / `shipping-tax`
- `item-promotion-discount` — discount amount
- `ship-promotion-discount` — shipping discount
- `promotion-ids` — **THE KEY FIELD** for SNS bucketing
- `is-business-order` — true/false
- `ship-city`, `ship-state`, `ship-postal-code`, `ship-country`

## Prerequisites
- Amazon SP-API app with Orders scope
- LWA credentials: client_id, client_secret, refresh_token
- Seller account authorized for the app
- Marketplace ID: `ATVPDKIKX0DER` (US)

## Notes
- `CreatedBefore` must be at least 2 minutes before current time
- Reports take 30-60 seconds to generate
- The report is TSV (tab-separated), not CSV
- Poll every 5 seconds for report completion
- Rate limits: ~15 report requests per minute
- Some SNS orders may have additional promotion IDs alongside the SNS ones
- The `Non-Amazon` sales channel entries are typically Multi-Channel Fulfillment (MCF) orders
