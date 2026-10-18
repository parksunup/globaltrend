import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import type { LegalReviewPackage } from "../../../../lib/legal-release";
import PublicLawReader from "../../../public/laws/public-law-reader";
import WorkFrame from "../../frame";
import styles from "../../work.module.css";

export const dynamic = "force-dynamic";
export default async function LegalSnapshot({params}:{params:Promise<{id:string}>}) {
 const {id} = await params;
 if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
 const db = await createClient();
 const {data:{user}} = await db.auth.getUser();
 const {data:member} = user ? await db.from("team_memberships").select("role,is_active").eq("user_id",user.id).maybeSingle() : {data:null};
 if (!member?.is_active) notFound();
 const {data,error} = await db.from("law_versions").select("status,review_payload,content_hash").eq("id",id).maybeSingle();
 if (error || !data?.review_payload) notFound();
 const p = data.review_payload as LegalReviewPackage;
 return <WorkFrame><Link href="/work/legal">← 법제 검수·발행</Link><h1>{p.jurisdiction} · {p.instrument.title}</h1><p>{data.status === "published" ? "공개 중" : "미발행 판본"} · <Link href={`/work/legal/${id}/edit`}>내용 수정</Link></p><details><summary>내부 판본 기록</summary><p>{data.content_hash}</p></details><p>{p.versionLabel}</p>
  <h2>17개 기준 비교</h2>{p.cells.map(cell=><details className={styles.card} key={cell.id}><summary>{cell.criterionOrder}. {cell.criterionName}</summary><p>{cell.summary}</p><p>{cell.exceptions}</p><p>{cell.articleNumbers.join(" · ")}</p><a href={cell.sourceUrl} target="_blank" rel="noopener noreferrer">공식 원문 ↗</a></details>)}
  {p.document ? <PublicLawReader law={p.document} returnTo="/work/legal"/> : <p>이 판본에는 번역 전문이 없습니다. {p.availability === "official_index" ? "한국 공식 원문 색인을 참고해 주세요." : "GDPR 본문은 저장소에 포함되지 않았습니다."}</p>}
 </WorkFrame>;
}
