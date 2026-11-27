import { gunzipSync } from 'node:zlib'

type AssessmentHandoff = { version: number; jurisdictions: string[]; counts: Array<{ jurisdiction: string; total: number; needsAction: number }>; findings: Array<{ jurisdiction: string; questionId: string; question: string; status: string; preparationGuide: string }> }

const APP_SCHEME = 'globaltrend-advisor'
const jurisdictionLabels: Record<string, string> = { JP: '일본', CN: '중국', EU: 'EU', UK: '영국', 'US-CA': '미국 캘리포니아주', SG: '싱가포르' }
const findingStatuses: Record<string, string> = {
  partial: '일부 준비됨', not_started: '추가 준비 필요', unknown: '확인 필요',
  // Accept links created by the already deployed website while people install the update.
  '일부 준비됨': '일부 준비됨', '추가 준비 필요': '추가 준비 필요', '확인 필요': '확인 필요',
}

export function parseAssessmentLink(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== `${APP_SCHEME}:` || url.hostname !== 'assessment') return null
    const encoded = url.hash.slice(1)
    if (!encoded || encoded.length > 32_000) return null
    const json = gunzipSync(Buffer.from(encoded, 'base64url'), { maxOutputLength: 256_000 }).toString('utf8')
    const value = JSON.parse(json) as Partial<AssessmentHandoff>
    if (value.version !== 1 || !Array.isArray(value.jurisdictions) || value.jurisdictions.length > 6 || !Array.isArray(value.counts) || !Array.isArray(value.findings) || value.findings.length > 129) return null
    if (!value.jurisdictions.every(code => typeof code === 'string' && code in jurisdictionLabels)) return null
    const counts = value.counts.map(item => {
      if (!item || typeof item.jurisdiction !== 'string' || !Object.values(jurisdictionLabels).includes(item.jurisdiction) || !Number.isInteger(item.total) || item.total < 0 || item.total > 129 || !Number.isInteger(item.needsAction) || item.needsAction < 0 || item.needsAction > item.total) throw new Error('invalid counts')
      return `- ${item.jurisdiction}: 응답 ${item.total}개 중 보완 필요 ${item.needsAction}개`
    })
    const findings = value.findings.map(item => {
      if (!item || typeof item.jurisdiction !== 'string' || !Object.values(jurisdictionLabels).includes(item.jurisdiction) || typeof item.questionId !== 'string' || !/^[A-Z0-9-]{2,24}$/.test(item.questionId) || typeof item.question !== 'string' || item.question.length > 500 || typeof item.status !== 'string' || !Object.hasOwn(findingStatuses, item.status) || typeof item.preparationGuide !== 'string' || item.preparationGuide.length > 1_200) throw new Error('invalid finding')
      return `• ${item.jurisdiction} / ${item.questionId} · ${item.question}\n  응답: ${findingStatuses[item.status]}\n  점검 안내: ${item.preparationGuide}`
    })
    const selected = value.jurisdictions.map(code => jurisdictionLabels[code]).join(', ')
    return [`자가점검 결과: 선택 지역 ${selected || '없음'}`, '지역별 요약:', ...counts, '보완이 필요한 응답:', ...(findings.length ? findings : ['보완이 필요한 항목이 없습니다.']), '위 내용은 사용자가 자가점검에서 선택한 답변이며 법적 준수 판정이 아닙니다.'].join('\n')
  } catch {
    return null
  }
}
