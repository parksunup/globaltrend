const { test } = require('node:test')
const assert = require('node:assert/strict')
const { gzipSync } = require('node:zlib')
const { parseAssessmentLink } = require('../src/assessment-handoff.ts')

function link(findings) {
  const payload = {
    version: 1,
    jurisdictions: ['JP'],
    counts: [{ jurisdiction: '일본', total: 3, needsAction: findings.length }],
    findings: findings.map((status, index) => ({
      jurisdiction: '일본', questionId: `JP-0${index + 1}`, question: `점검 질문 ${index + 1}`,
      status, preparationGuide: '공식 안내를 확인하세요.',
    })),
  }
  return `globaltrend-advisor://assessment#${gzipSync(JSON.stringify(payload)).toString('base64url')}`
}

test('website answer codes reach the counselor as readable assessment context', () => {
  const context = parseAssessmentLink(link(['partial', 'not_started', 'unknown']))
  assert.ok(context)
  for (const status of ['일부 준비됨', '추가 준비 필요', '확인 필요']) assert.match(context, new RegExp(status))
  assert.match(context, /보완 필요 3개/)
})

test('links created by the currently deployed website remain readable', () => {
  const context = parseAssessmentLink(link(['일부 준비됨', '추가 준비 필요', '확인 필요']))
  assert.ok(context)
  assert.match(context, /응답: 추가 준비 필요/)
})

test('unknown or tampered assessment status is rejected', () => {
  assert.equal(parseAssessmentLink(link(['허위 상태'])), null)
  assert.equal(parseAssessmentLink('https://example.com/assessment'), null)
})
