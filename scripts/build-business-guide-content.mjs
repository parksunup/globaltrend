import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = {
  JP: ['일본', '일본 APPI 기업 준수 안내서', 'japan-appi-guide.md', 'https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/'],
  CN: ['중국', '중국 PIPL 기업 준수 안내서', 'china-pipl-guide.md', 'https://www.cac.gov.cn/2025-02/14/c_1741233507681519.htm'],
  EU: ['EU', 'EU GDPR 기업 실무 안내서', 'eu-gdpr-guide.md', 'https://www.edpb.europa.eu/sme_en'],
  UK: ['영국', '영국 UK GDPR 기업 준수 안내서', 'uk-data-protection-guide.md', 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/'],
  'US-CA': ['미국 캘리포니아주', '캘리포니아 CCPA/CPRA 사업자 준수 안내서', 'california-ccpa-guide.md', 'https://cppa.ca.gov/regulations/'],
  SG: ['싱가포르', '싱가포르 PDPA 기업 준수 안내서', 'singapore-pdpa-guide.md', 'https://www.pdpc.gov.sg/guidelines-and-consultation'],
}

function headingLines(markdown) {
  return [...markdown.matchAll(/^(#{1,4})\s+(.+?)\s*#*\s*$/gm)].map(match => ({
    level: match[1].length,
    title: match[2].trim(),
    start: match.index,
    bodyStart: match.index + match[0].length,
  }))
}

function extractSection(markdown, headings, title) {
  const index = headings.findIndex(item => item.title === title)
  if (index < 0) return null
  const current = headings[index]
  const next = headings.slice(index + 1).find(item => item.level <= current.level)
  return markdown.slice(current.start, next?.start ?? markdown.length).trim()
}

const output = {}
for (const [code, [label, title, filename, officialUrl]] of Object.entries(config)) {
  const guidePath = path.join(root, 'docs/business-advisor/guides', filename)
  const mappingPath = path.join(root, 'docs/business-advisor/guides/ko/question-guide-references', `${code}.json`)
  const markdown = (await readFile(guidePath, 'utf8')).replace(/\r/g, '').trim()
  const mapping = JSON.parse(await readFile(mappingPath, 'utf8'))
  const headings = headingLines(markdown)
  const sections = mapping.sections.map(section => {
    const content = extractSection(markdown, headings, section.title)
    if (!content) throw new Error(`${code}: guide heading not found: ${section.title}`)
    return { ...section, markdown: content }
  })
  const sectionIds = new Set(sections.map(section => section.id))
  for (const question of mapping.questions) {
    if (question.sectionIds.some(id => !sectionIds.has(id))) throw new Error(`${code}: unknown section id on ${question.questionId}`)
  }
  output[code] = {
    code, label, title, filename, guidePath: `/public/business-readiness/guides?country=${encodeURIComponent(code)}`,
    officialUrl, markdown, sections,
    questions: mapping.questions.map(question => ({
      questionId: question.questionId,
      sectionIds: question.sectionIds,
      sourceNote: question.sourceNote,
      externalNote: question.externalNote ?? '',
      coverageNote: question.coverageNote ?? '',
      unmappedReason: question.unmappedReason ?? '',
    })),
  }
}

const destination = path.join(root, 'data/business-readiness/guides-content.json')
await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`Built six guide editions and ${Object.values(output).reduce((count, guide) => count + guide.questions.length, 0)} question mappings: ${path.relative(root, destination)}`)
