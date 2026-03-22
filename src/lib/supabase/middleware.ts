import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes
  if (
    pathname === "/login" ||
    pathname === "/restricted" ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/legal/") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/push/send" ||
    pathname.startsWith("/api/overview/") ||
    pathname === "/api/inventory-audit" ||
    pathname === "/api/sales-data"
  ) {
    return supabaseResponse;
  }

  // Unauthenticated → login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Check admin emails
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length > 0 && !adminEmails.includes(user.email?.toLowerCase() || "")) {
    const url = request.nextUrl.clone();
    url.pathname = "/restricted";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
