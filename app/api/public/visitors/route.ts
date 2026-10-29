import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const cookieName = "gt_visitor_id";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const seoulDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export async function POST(request: Request) {
  const origin = (await headers()).get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Visitor counts unavailable" }, { status: 503 });

  const db = createClient(url, key, { auth: { persistSession: false } });
  const cookieStore = await cookies();
  const stored = cookieStore.get(cookieName)?.value;
  const visitorId = stored && uuid.test(stored) ? stored : randomUUID();
  const day = seoulDay();
  const { error: insertError } = await db.from("site_visit_days").insert({ visitor_id: visitorId, visited_on: day });
  if (insertError && insertError.code !== "23505") {
    return NextResponse.json({ error: "Visitor counts unavailable" }, { status: 503 });
  }
  const [{ data: daily, error: dailyError }, { data: lifetime, error: lifetimeError }] = await Promise.all([
    db.from("site_visit_daily_totals").select("visitor_count").eq("visited_on", day).maybeSingle(),
    db.from("site_visit_lifetime_total").select("visitor_count").eq("singleton", true).single(),
  ]);
  if (dailyError || lifetimeError) {
    return NextResponse.json({ error: "Visitor counts unavailable" }, { status: 503 });
  }
  const response = NextResponse.json({ today: daily?.visitor_count ?? 0, total: lifetime?.visitor_count ?? 0, day });
  response.headers.set("Cache-Control", "no-store");
  if (!stored || !uuid.test(stored)) {
    response.cookies.set(cookieName, visitorId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return response;
}
