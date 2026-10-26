import PublicHome from "./public/page";
import { PublicThemeProvider } from "./public/public-theme";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (process.env.SITE_ENTRY === "public") return <PublicThemeProvider><PublicHome /></PublicThemeProvider>;
  redirect('/team');
}
