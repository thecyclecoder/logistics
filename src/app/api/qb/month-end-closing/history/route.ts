import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("month_end_closings")
    .select("id, closing_month, status, completed_at")
    .order("closing_month", { ascending: false })
    .limit(12);

  return NextResponse.json(data || []);
}
