import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "국제요정 | 글로벌 개인정보 보호 동향·법제",
  description: "글로벌 개인정보 보호 동향을 살펴보고 해외 법제를 비교하는 플랫폼"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
