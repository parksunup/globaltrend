import { PublicFooter, PublicHeader } from "../public-navigation";
import ReportForm from "./report-form";

export const metadata = { title: "의견·오류 신고 · 국제요정" };

export default function ReportPage() {
  return <main style={{ minHeight: "100vh", background: "#0b1a29", color: "#edf4f8" }}>
    <PublicHeader active="/public/report" />
    <ReportForm />
    <PublicFooter />
  </main>;
}
