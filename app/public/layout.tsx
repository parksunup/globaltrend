import type { Metadata } from "next";
export const metadata: Metadata = { title: "GlobalTrend · 글로벌 개인정보 동향", description: "글로벌 개인정보 보호 동향과 해외 법제 비교" };
export default function PublicLayout({children}: {children: React.ReactNode}) { return children; }
