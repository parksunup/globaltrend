import { app, BrowserWindow, ipcMain, shell, safeStorage } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createChatGptConnection } from './vendor/ieumoffice-chatgpt/connection'
import { createChatGptConnectionFileStore } from './vendor/ieumoffice-chatgpt/credentials'
import { assertSecureStorage } from './vendor/settings-secrets'

const APP_NAME = 'GlobalTrend 기업 개인정보 보호 도우미'
const DEFAULT_EVIDENCE_API_URL = 'https://globaltrend-six.vercel.app/api/business-advisor/evidence'
const DEFAULT_MODEL = 'gpt-5-mini'
let connection: ReturnType<typeof createChatGptConnection>

type Evidence = {
  jurisdiction: string
  jurisdictionName: string
  lawId: string
  lawTitle: string
  version: string
  sectionId: string
  sectionTitle: string
  quote: string
  officialUrl: string
  inAppUrl: string
  reviewStatus: 'published' | 'official'
}

type EvidenceResult = { evidence: Evidence[]; notice: string }

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1050,
    height: 780,
    minWidth: 760,
    minHeight: 620,
    title: APP_NAME,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  void window.loadFile(join(__dirname, 'renderer', 'index.html'))
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  return window
}

function trustedFrame(event: Electron.IpcMainInvokeEvent): boolean {
  return event.senderFrame?.url === pathToFileURL(join(__dirname, 'renderer', 'index.html')).href
}

function evidenceApiUrl(): URL {
  const url = new URL(process.env.GLOBALTREND_EVIDENCE_API_URL || DEFAULT_EVIDENCE_API_URL)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('근거 API 주소는 HTTPS를 사용해야 합니다.')
  }
  return url
}

async function findEvidence(question: string, jurisdictions: string[]): Promise<EvidenceResult> {
  let response: Response
  try {
    response = await fetch(evidenceApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ question, jurisdictions }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new Error('국제요정의 발행 법령 자료에 연결하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.')
  }
  const body = await response.json().catch(() => ({})) as {
    evidence?: unknown
    notice?: unknown
    error?: unknown
  }
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : `발행 법령 자료 조회 실패 (HTTP ${response.status})`)
  const evidence = Array.isArray(body.evidence) ? body.evidence as Evidence[] : []
  const validEvidence = evidence.filter(item => item &&
    (item.reviewStatus === 'published' || item.reviewStatus === 'official') &&
    typeof item.quote === 'string' && item.quote.trim() &&
    typeof item.officialUrl === 'string' && item.officialUrl.startsWith('https://'))
  return {
    evidence: validEvidence,
    notice: typeof body.notice === 'string' ? body.notice : '',
  }
}

async function askChatGpt(question: string, jurisdictions: string[]) {
  const trimmed = question.trim()
  if (!trimmed || trimmed.length > 8_000) throw new Error('질문은 1자 이상 8,000자 이하로 입력해 주세요.')
  if (!Array.isArray(jurisdictions) || jurisdictions.length === 0 || jurisdictions.some(value => typeof value !== 'string')) {
    throw new Error('확인할 국가·지역을 하나 이상 선택해 주세요.')
  }
  const found = await findEvidence(trimmed, jurisdictions)
  if (found.evidence.length === 0) {
    throw new Error(found.notice || '선택한 국가의 발행 자료에서 관련 근거를 찾지 못했습니다. 근거가 없어 법률 답변을 생성하지 않았습니다.')
  }

  const accessToken = await connection.accessToken()
  const model = process.env.GLOBALTREND_CHATGPT_MODEL?.trim() || DEFAULT_MODEL
  const evidenceText = found.evidence.map((item, index) => [
    `[${index + 1}] ${item.jurisdictionName} · ${item.lawTitle} · 판본 ${item.version} · ${item.sectionTitle}`,
    `검수 상태: ${item.reviewStatus}`,
    `근거 본문:\n${item.quote}`,
    `공식 원문: ${item.officialUrl}`,
  ].join('\n')).join('\n\n')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: '당신은 해외 진출 기업의 개인정보 보호를 돕는 안내 도우미입니다. 제공된 발행 법령 근거만 사용해 한국어로 답하세요. 사실 주장과 설명에는 해당 근거 번호를 [1] 형식으로 붙이세요. 근거에 없는 법적 요건·예외·기한은 추측하지 말고, 확인 자료에 없다고 분명히 말하세요. 관할권마다 법률 명칭과 요건을 구분하세요. 답변은 일반 정보이며 법률 자문이나 준수 판정이 아닙니다.' }] },
        { role: 'user', content: [{ type: 'input_text', text: `질문:\n${trimmed}\n\n선택한 국가·지역: ${jurisdictions.join(', ')}\n\n아래는 국제요정에서 조회한 사람 검수·발행 완료 또는 공식 법령 자료입니다. 원문 내용을 넘어 추론하지 말고, 인용 번호를 유지하세요.\n\n${evidenceText}` }] },
      ],
      store: false,
    }),
  })
  const body = await response.json().catch(() => ({})) as {
    output_text?: unknown
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
    error?: { message?: string; code?: string }
  }
  if (response.status === 401) {
    await connection.dropSession()
    throw new Error('ChatGPT 연결이 만료됐습니다. 다시 연결해 주세요.')
  }
  if (!response.ok) throw new Error(body.error?.message || `ChatGPT 요청 실패 (HTTP ${response.status})`)
  let answer: string
  if (typeof body.output_text === 'string') answer = body.output_text
  else answer = body.output?.flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text).join('\n') ?? ''
  if (!answer) throw new Error('ChatGPT 응답에서 답변 본문을 찾지 못했습니다.')
  return { answer, evidence: found.evidence, notice: found.notice, model }
}

app.whenReady().then(() => {
  app.setAppUserModelId('org.globaltrend.business-advisor')
  connection = createChatGptConnection({
    store: createChatGptConnectionFileStore(app.getPath('userData')),
    agentName: APP_NAME,
  })
  ipcMain.handle('chatgpt:status', async (event) => {
    if (!trustedFrame(event)) throw new Error('요청한 화면을 확인할 수 없습니다.')
    return {
      ...(await connection.state()),
      storageAvailable: safeStorage.isEncryptionAvailable() && safeStorage.getSelectedStorageBackend?.() !== 'basic_text',
    }
  })
  ipcMain.handle('chatgpt:connect', async (event) => {
    if (!trustedFrame(event)) throw new Error('요청한 화면을 확인할 수 없습니다.')
    assertSecureStorage()
    const result = await connection.signIn({
      openBrowser: async (url) => { await shell.openExternal(url); return true },
      pages: {
        done: { lang: 'ko', title: '연결되었습니다', body: 'GlobalTrend 앱으로 돌아와 주세요.' },
        failed: { lang: 'ko', title: '연결에 실패했습니다', body: '앱으로 돌아와 다시 시도해 주세요.' },
      },
    })
    if (!result.ok) return { ok: false, message: `로그인 실패: ${result.reason}${result.step ? ` (${result.step})` : ''}` }
    return { ok: true }
  })
  ipcMain.handle('chatgpt:disconnect', async (event) => {
    if (!trustedFrame(event)) throw new Error('요청한 화면을 확인할 수 없습니다.')
    return connection.signOut()
  })
  ipcMain.handle('chatgpt:ask', (event, question: string, jurisdictions: string[]) => {
    if (!trustedFrame(event)) throw new Error('요청한 화면을 확인할 수 없습니다.')
    return askChatGpt(question, jurisdictions)
  })
  ipcMain.handle('source:open', async (event, value: string) => {
    if (!trustedFrame(event)) throw new Error('요청한 화면을 확인할 수 없습니다.')
    let url: URL
    try { url = new URL(value) } catch { throw new Error('출처 주소가 올바르지 않습니다.') }
    if (url.protocol !== 'https:') throw new Error('보안을 위해 HTTPS 주소만 열 수 있습니다.')
    await shell.openExternal(url.toString())
  })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
