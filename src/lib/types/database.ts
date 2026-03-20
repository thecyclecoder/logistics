export type Source = "amazon" | "3pl" | "shopify" | "manual";
export type InventorySource = "amazon_fba" | "amazon_fbm" | "3pl" | "quickbooks";
export type Channel = "amazon" | "shopify";
export type CronStatus = "running" | "success" | "error";

export type ItemType = "inventory" | "bundle";

export interface Product {
  id: string;
  quickbooks_id: string;
  quickbooks_name: string;
  sku: string | null;
  category: string | null;
  unit_cost: number | null;
  reorder_point: number;
  lead_time_days: number | null;
  active: boolean;
  item_type: ItemType;
  bundle_id: string | null;
  bundle_quantity: number | null;
  product_category: "finished_good" | "component" | null;
  created_at: string;
  updated_at: string;
}

export interface SkuMapping {
  id: string;
  product_id: string;
  external_id: string;
  source: Source;
  label: string | null;
  unit_multiplier: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  products?: Product;
}

export interface InventorySnapshot {
  id: string;
  product_id: string;
  source: InventorySource;
  quantity: number;
  snapshot_at: string;
  raw_payload: Record<string, unknown> | null;
}

export interface SaleRecord {
  id: string;
  product_id: string;
  channel: Channel;
  order_id: string;
  quantity: number;
  gross_amount: number;
  refund_amount: number;
  fee_amount: number;
  net_amount: number;
  sale_date: string;
  period_month: string;
  raw_payload: Record<string, unknown> | null;
}

export interface CronLog {
  id: string;
  job_name: string;
  status: CronStatus;
  records_processed: number | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface CurrentInventory {
  product_id: string;
  quickbooks_name: string;
  sku: string | null;
  reorder_point: number;
  amazon_fba: number;
  amazon_fbm: number;
  three_pl: number;
  quickbooks: number;
  total: number;
  last_snapshot_at: string | null;
}

export interface MonthlySalesSummary {
  period_month: string;
  channel: Channel;
  product_id: string;
  quickbooks_name: string;
  total_quantity: number;
  total_gross: number;
  total_refunds: number;
  total_fees: number;
  total_net: number;
  order_count: number;
}
