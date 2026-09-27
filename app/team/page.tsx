import { redirect } from "next/navigation";
import ReviewShell from "../components/review-shell";
import LoginForm from "./login-form";
import { loadTeamReviewItems } from "../review-data";
import { createClient } from "../../lib/supabase/server";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="login-page"><LoginForm /></main>;
  const { items } = await loadTeamReviewItems(supabase);
  return <ReviewShell initialItems={items} dataSource="supabase" teamMode />;
}
