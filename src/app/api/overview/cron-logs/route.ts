import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("cron_logs")
    .select("id, job_name, status, records_processed, started_at")
    .order("started_at", { ascending: false })
    .limit(10);

  const response = NextResponse.json(data || []);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
