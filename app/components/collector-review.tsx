import SubmissionFeedback from './submission-feedback';
import { collectorFeedbackId } from '../../lib/collector-review';
import type { CollectorReview } from '../../lib/collector-review';

const labels: Record<string,string> = {
  pending:'초안 작성 대기',claimed:'초안 작성 중',submitted:'초안 저장 완료',needs_human_review:'사람 확인 필요',
  failed:'실패 · 재시도 확인',cancelled:'이전 판본 · 처리 중단',draft:'미검수 초안',in_review:'사람 검수 대기',
  approved:'사람 승인 완료 · 미발행',published:'발행 완료',discovered:'발견 · 본문 확보 대기',queued:'본문 확보',drafted:'초안 생성됨',
};
export default function CollectorReviewPanel({ data, error, commitSha }: { data: CollectorReview | null; error: boolean; commitSha?: string }) {
  return <section aria-label="자동 수집 자료 검수" style={{margin:'2rem 0'}}>
    <h2>자동 수집 자료와 한국어 초안</h2>
    <p>DB에서 직접 불러오는 자료입니다. 새 자료 저장 후 화면을 새로고침하면 커밋·재배포 없이 표시됩니다. AI 근거 검사와 사람 승인은 별개입니다.</p>
    {error ? <p role="alert">수집 자료를 읽지 못했습니다. DB 변경 적용 여부와 팀 권한을 확인해 주세요. 빈 대기함으로 처리하지 않았습니다.</p> : data?.items.length === 0 ? <p>아직 저장된 자동 수집 자료가 없습니다. 이것만으로 공식 사이트에 새 자료가 없었다고 판단할 수는 없습니다.</p> : null}
    {data && <p>DB 사용량: {(data.database_bytes / 1000000).toFixed(1)} MB · 수집 쓰기 중단 기준: 400 MB · 최근 최대 {data.limit}건 표시</p>}
    {data?.items.map(item => <article key={item.id} style={{border:'1px solid #aaa',padding:'1.2rem',margin:'1rem 0',borderRadius:12}}>
      <h3>{item.report?.title_ko ?? item.title_original}</h3>
      <p>{item.source_name} · 원문 게시일: {item.published_at?.slice(0,10) ?? '미확정'} · {labels[item.pipeline_status] ?? item.pipeline_status}</p>
      <p><a href={item.canonical_url} target="_blank" rel="noopener noreferrer">공식 원문 ↗</a> · {item.title_original}</p>
      <p>읽은 범위: {item.metadata.read_scope ?? '본문 미확보'} · 관련성: {item.relevance_status === 'relevant' ? '관련 있음' : '사람 확인 필요'}</p>
      {item.metadata.fetch_failure && <p role="alert">본문 수집 실패: {item.metadata.fetch_failure}</p>}
      <details><summary>날짜의 의미와 원문 판본</summary>
        <p>현재 원문 판본: {item.current_revision_id ?? '없음'}</p>
        {item.metadata.date_observations?.map((d,i)=><p key={i}>{d.meaning}: {d.value} · 표시 위치: {d.locator}</p>)}
        {item.metadata.requires_review && <p>날짜 또는 원문 범위의 사람 확인이 필요합니다.</p>}
      </details>
      <details><summary>현재 저장된 원문 본문</summary><p style={{whiteSpace:'pre-wrap'}}>{item.current_content_text ?? '본문을 확보하지 못했습니다.'}</p></details>
      {item.report && <>
        <p><strong>{labels[item.report.status] ?? item.report.status}</strong> · 사람 검수: {item.report.human_reviewed ? '완료' : '미완료'}</p>
        <p>{item.report.one_line_summary_ko}</p>
        <details><summary>상세 설명·핵심 내용·근거</summary>
          <p style={{whiteSpace:'pre-wrap'}}>{item.report.detailed_summary_ko}</p>
          <ul>{item.report.key_points?.map((point,i)=><li key={i}>{point?.text ?? '형식을 확인해야 하는 핵심 내용'}</li>)}</ul>
          <p>개인정보 보호상 의미 · 작성자 해석: {item.report.policy_implications_ko}</p>
          <p>초안 입력 판본: {item.report.source_item_revision_id} · 지침: {item.report.instruction_version}</p>
          <p>AI 검사 표시는 원문 인용의 일치 확인입니다. 내용의 정확성이나 법적 판단을 승인한 것이 아닙니다.</p>
          {item.evidence.map(e=><blockquote key={e.id}><p>{e.locator.claim}</p><p>{e.excerpt}</p><cite>{e.locator.location} · 판본 {e.locator.revision_id}</cite></blockquote>)}
          <p>불확실함·미열람 범위: {JSON.stringify(item.report.automation_metadata?.limitations ?? [])}</p>
          <details><summary>이 초안이 읽은 정확한 원문 판본</summary><p style={{whiteSpace:'pre-wrap'}}>{item.report_content_text ?? '입력 판본 본문을 확인할 수 없습니다.'}</p></details>
        </details>
        <SubmissionFeedback itemId={collectorFeedbackId(item.id,item.report.source_item_revision_id)} branch="collector-data" commitSha={commitSha} />
      </>}
      {item.metadata.unread_attachments && item.metadata.unread_attachments.length > 0 && <details><summary>읽지 못한 연결 자료</summary><ul>{item.metadata.unread_attachments.map((u,i)=><li key={i}><a href={u} rel="noopener noreferrer" target="_blank">{u}</a></li>)}</ul></details>}
      {item.jobs.map(job=><details key={job.id}><summary>{labels[job.status] ?? job.status} · 시도 {job.attempts}/3</summary>
        <p>작업 {job.id} · 입력 판본 {job.source_item_revision_id} · 지침 {job.instruction_version}</p>
        {job.last_error && <p>{job.last_error}</p>}
        {job.status === 'needs_human_review' && job.proposed_draft && <>
          <h4>{job.proposed_draft.title_ko}</h4><p>{job.proposed_draft.summary_ko}</p><p style={{whiteSpace:'pre-wrap'}}>{job.proposed_draft.details_ko}</p>
          <ul>{job.proposed_draft.key_points?.map((p,i)=><li key={i}>{p?.text ?? '형식 확인 필요'}</li>)}</ul>
          <p>작성자 해석: {job.proposed_draft.policy_implications_ko}</p>
          {job.proposed_draft.evidence?.map((e,i)=><blockquote key={i}>{e.claim}<p>{e.quote}</p><cite>{e.locator}</cite></blockquote>)}
          <p>불확실함·미열람 범위: {JSON.stringify(job.proposed_draft.limitations ?? [])}</p>
          <details><summary>변경 제안이 읽은 정확한 원문 판본</summary><p style={{whiteSpace:'pre-wrap'}}>{job.input_content_text}</p></details>
          <SubmissionFeedback itemId={collectorFeedbackId(item.id,job.source_item_revision_id)} branch="collector-data" commitSha={commitSha} />
        </>}
      </details>)}
    </article>)}
  </section>;
}
