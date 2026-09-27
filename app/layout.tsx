import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlobalTrend 검토 보드",
  description: "글로벌 개인정보 보호 동향·법제 자료 검수 화면"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}