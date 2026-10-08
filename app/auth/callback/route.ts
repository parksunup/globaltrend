import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") || "/team";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/team";
  if (!code) return NextResponse.redirect(new URL(safeNext, request.url));
  const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`${safeNext}?feedback_login=failed`, request.url));
  return NextResponse.redirect(new URL(safeNext, request.url));
}
