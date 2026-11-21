import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  WRITING_POLICY,
  sealWritingReview,
  validateWritingReview,
  auditWritingDensity,
} from '../lib/trend-writing-quality.ts';

export function claimContext(raw) {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.jobs) ? raw.jobs : [raw];
  if (
    rows.length !== 1 ||
    !rows[0]?.revision_id ||
    !rows[0]?.input_hash ||
    !rows[0]?.content_text ||
    !rows[0]?.official_url
  ) {
    throw new Error('정확한 임대 원문 1건의 revision_id/input_hash/content_text/official_url이 필요합니다.');
  }
  return rows[0];
}

export function createWritingPacket(raw) {
  const claim = claimContext(raw);
  const documents = WRITING_POLICY.required_documents.map((path) => {
    const text = readFileSync(path, 'utf8');
    const canonicalText = text.replace(/\r\n/g, '\n');
    const sha256 = createHash('sha256').update(canonicalText).digest('hex');
    if (WRITING_POLICY.instruction_hashes[path] !== sha256) {
      throw new Error('지침 해시가 정책과 다릅니다: ' + path);
    }
    return { path, sha256, text };
  });

  return {
    policy: WRITING_POLICY,
    claim,
    documents,
    workflow: [
      '접근 가능한 공식 원문을 실제로 읽고, 읽은 범위와 위치를 정확히 기록',
      'claim 본문이 메뉴·오류 문구·빈 내용뿐이거나 제3자 요약만으로 사건의 핵심을 확인할 수 없으면 즉시 실패시키지 말고, 기관·사건번호·제목·날짜와 관련 링크로 감독기관·법원·정부기관의 공식 원문을 찾아 직접 대조',
      '공식 원문이 같은 사건임을 식별 정보로 확인한 뒤 원문에서 확인한 사실만 사용; 원 claim URL·revision·hash는 유지하고 공식 원문 URL·읽은 범위·위치는 writing_review.supplements에 기록',
      '공식 원문을 찾지 못하면 추측하지 않고 검색 경로와 실패 이유를 기록; 제출 검증기가 공식 원문 근거를 막으면 우회하지 말고 공통 제출 계약 수정 대상으로 남김',
      '필요한 연결자료만 확인; 열 수 없거나 불필요한 링크 때문에 원고 전체를 중단하지 않고 그 자료에만 있는 사실은 쓰지 않음',
      '확인된 핵심 사실만 근거로 작성하고 부족한 설명은 추정 대신 limitations에 기록',
      '한국어 제목·요약·본문 작성 후 내용·흐름·법적 상태·수치·용어 역대조',
      'writing_review를 실제 작성; --seal은 해시만 계산하며 검토 기록을 만들어주지 않음',
      '--check draft.json --source claim.json 실제 통과 후 기존 submit_trend_draft 제출',
      'reports·publication_working_copies의 실제 문자열과 검수 전 상태 재조회',
    ],
    review_template: {
      instruction_hashes: WRITING_POLICY.instruction_hashes,
      policy_id: WRITING_POLICY.policy_id,
      source_revision_id: claim.revision_id,
      input_hash: claim.input_hash,
      article_type: 'TODO',
      source_reading: {
        url: claim.official_url,
        read_scope: 'TODO',
        locator: 'TODO',
        reviewed_at: 'TODO',
      },
      supplements: [],
      coverage: WRITING_POLICY.common_aspects.map((aspect) => ({
        aspect,
        status: 'TODO',
        detail: 'TODO',
        evidence_indices: [],
      })),
      editorial_review: Object.fromEntries(
        WRITING_POLICY.editorial_checks.map((key) => [key, 'TODO']),
      ),
    },
  };
}

export function writePacket(input, output) {
  const packet = createWritingPacket(JSON.parse(readFileSync(input, 'utf8')));
  writeFileSync(output, JSON.stringify(packet, null, 2) + '\n');
  return packet;
}

export function sealDraft(file) {
  const draft = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, JSON.stringify(sealWritingReview(draft), null, 2) + '\n');
}

export { validateWritingReview, auditWritingDensity };
