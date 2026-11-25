const status = document.querySelector('#status')
const connect = document.querySelector('#connect')
const disconnect = document.querySelector('#disconnect')
const form = document.querySelector('#composer')
const send = document.querySelector('#send')
const question = document.querySelector('#question')
const transcript = document.querySelector('#transcript')
const model = document.querySelector('#model')
const newChat = document.querySelector('#new-chat')
const error = document.querySelector('#error')
let conversation = []
let signedIn = false
let busy = false
let failedTurn = null
let assessmentContext = ''
let pendingAssessmentContext = ''
let modelLoadError = ''

function showError(message) {
  error.replaceChildren()
  error.hidden = !message
  if (!message) return
  const lines = message.split('\n')
  const summary = document.createElement('p')
  summary.className = 'error-summary'
  summary.textContent = lines[0]
  error.append(summary)
  if (lines.length > 1) {
    const details = document.createElement('details')
    const heading = document.createElement('summary')
    heading.textContent = '오류 상세 보기'
    const body = document.createElement('pre')
    body.textContent = lines.slice(1).join('\n').trim()
    details.append(heading, body)
    error.append(details)
  }
}

function updateControls() {
  send.disabled = !signedIn || busy || !question.value.trim() || !model.value
  question.disabled = !signedIn || busy
  model.disabled = !signedIn || busy
}

function addMessage(role, text = '') {
  const article = document.createElement('article')
  article.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'}`
  const avatar = document.createElement('div')
  avatar.className = 'avatar'
  if (role === 'user') avatar.textContent = '나'
  else {
    avatar.classList.add('fairy-avatar')
    const fairy = document.createElement('img')
    fairy.src = 'assets/fairy-transparent.png'
    fairy.alt = ''
    avatar.append(fairy)
  }
  const body = document.createElement('div')
  body.className = 'message-body'
  const speaker = document.createElement('span')
  speaker.className = 'speaker'
  speaker.textContent = role === 'user' ? '질문' : '국제요정 상담 도우미'
  const paragraph = document.createElement('p')
  paragraph.textContent = text
  body.append(speaker, paragraph)
  article.append(avatar, body)
  transcript.append(article)
  transcript.scrollTop = transcript.scrollHeight
  return { article, body, paragraph }
}

function sourceKey(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'eqid') url.searchParams.delete(key)
    }
    return url.href
  } catch {
    return null
  }
}

function appendAnswerText(parent, text, references, state = { lastReference: null }) {
  const inline = /\*\*([^*\n]+)\*\*|\[자료\s*(\d+)\]|\[([^\]\n]+)\]\((https:\/\/[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)\)/g
  function appendText(value) {
    if (value.trim()) state.lastReference = null
    parent.append(document.createTextNode(value))
  }
  let offset = 0
  for (const match of text.matchAll(inline)) {
    appendText(text.slice(offset, match.index))
    const [, bold, internal, label, url] = match
    if (bold) {
      const strong = document.createElement('strong')
      appendAnswerText(strong, bold, references, state)
      parent.append(strong)
    } else {
      const reference = internal ? references.internal.get(Number(internal)) : references.urls.get(sourceKey(url))
      if (!reference) {
        appendText(label ?? match[0])
      } else if (state.lastReference !== reference) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'inline-citation'
        button.textContent = '[' + reference.number + ']'
        button.setAttribute('aria-label', '참고 출처 ' + reference.number + ' 보기')
        button.addEventListener('click', reference.open)
        parent.append(button)
        state.lastReference = reference
      }
    }
    offset = match.index + match[0].length
  }
  appendText(text.slice(offset))
}

function renderAdvisorAnswer(text, references) {
  const answer = document.createElement('div')
  answer.className = 'formatted-answer'
  const lines = text.replace(/\r\n?/g, '\n')
    .replace(/\\(?=\n|$)/g, '')
    .replace(/\\([*\[\]()#\-_.:])/g, '$1')
    .replace(/\((\[[^\]\n]+\]\(https:\/\/[^\s()]+\))\)/g, '$1')
    .split('\n')
  let list = null
  let paragraph = null
  for (const line of lines) {
    const value = line.trim()
    const bullet = /^(?:([-*+])|(\d+)[.)])\s+(.+)$/.exec(value)
    const heading = /^#{1,6}\s+(.+)$/.exec(value)
    if (bullet) {
      const tag = bullet[2] ? 'ol' : 'ul'
      if (list?.localName !== tag) {
        list = document.createElement(tag)
        if (bullet[2]) list.start = Number(bullet[2])
        answer.append(list)
      }
      const item = document.createElement('li')
      appendAnswerText(item, bullet[3], references)
      list.append(item)
      paragraph = null
    } else {
      list = null
      if (heading) {
        const title = document.createElement('h3')
        appendAnswerText(title, heading[1], references)
        answer.append(title)
        paragraph = null
      } else if (value) {
        if (!paragraph) {
          paragraph = document.createElement('p')
          answer.append(paragraph)
        } else {
          paragraph.append(document.createElement('br'))
        }
        appendAnswerText(paragraph, value, references)
      } else {
        paragraph = null
      }
    }
  }
  return answer
}

function appendSources(body, result) {
  const references = { internal: new Map(), urls: new Map() }
  const details = document.createElement('details')
  details.className = 'answer-sources'
  const summary = document.createElement('summary')
  const list = document.createElement('div')
  list.className = 'source-list'
  details.append(summary, list)
  function register(item, urls) {
    const reference = { number: list.childElementCount + 1, open: () => {
      details.open = true
      item.focus()
    } }
    item.tabIndex = -1
    list.append(item)
    for (const url of urls) {
      const key = sourceKey(url)
      if (key && !references.urls.has(key)) references.urls.set(key, reference)
    }
    return reference
  }
  const citations = result.webCitations ?? []
  const sources = result.evidence ?? []
  if (sources.length) {
    sources.forEach((source, index) => {
      const urls = [source.officialUrl, source.url]
      const existing = urls.map(url => references.urls.get(sourceKey(url))).find(Boolean)
      const citationIndex = source.citationIndex ?? index + 1
      if (existing) {
        references.internal.set(citationIndex, existing)
        return
      }
      const item = document.createElement('article')
      item.className = 'source-item'
      const title = document.createElement('strong')
      title.textContent = `[${list.childElementCount + 1}] ${source.jurisdiction} · ${source.title}`
      item.append(title)
      const meta = document.createElement('span')
      meta.textContent = [source.kind === 'trend' ? '공개 동향' : source.kind === 'comparison' ? '법제 비교' : source.kind === 'law' ? '공개 법제 자료' : source.kind === 'casebook' ? '상담사례집' : source.kind === 'assessment' ? '자가점검' : '기업 안내서', source.version].filter(Boolean).join(' · ')
      item.append(meta)
      const excerpt = document.createElement('details')
      const excerptLabel = document.createElement('summary')
      excerptLabel.textContent = '참고한 내용 보기'
      const excerptText = document.createElement('p')
      excerptText.textContent = source.excerpt
      excerpt.append(excerptLabel, excerptText)
      item.append(excerpt)
      const url = urls.find(sourceKey)
      if (url) {
        const open = document.createElement('button')
        open.type = 'button'
        open.textContent = source.officialUrl ? '공식 원문 열기 ↗' : '자료 열기 ↗'
        open.addEventListener('click', () => void window.advisor.openSource(url))
        item.append(open)
      }
      references.internal.set(citationIndex, register(item, urls))
    })
  } else if ((result.candidateEvidenceCount ?? 0) > 0) {
    const note = document.createElement('p')
    note.className = 'corpus-status'
    note.textContent = `국제요정 자료 후보 ${result.candidateEvidenceCount}건을 확인했지만 답변에서 출처로 인용하지 않았습니다.`
    body.append(note)
  }
  for (const citation of citations) {
    const key = sourceKey(citation.url)
    if (!key || references.urls.has(key)) continue
    const item = document.createElement('article')
    item.className = 'source-item'
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = `[${list.childElementCount + 1}] ${citation.title}`
    button.addEventListener('click', () => void window.advisor.openSource(citation.url))
    item.append(button)
    register(item, [citation.url])
  }
  if (list.childElementCount) {
    summary.textContent = `참고 출처 ${list.childElementCount}개 보기`
    body.append(details)
  }
  if (result.corpus && !result.corpus.publicContentAvailable) {
    const status = document.createElement('p')
    status.className = 'corpus-status'
    status.textContent = `현재 발행 동향·법제 자료 연결을 확인하지 못해 저장된 자가점검·기업 안내서 자료를 사용했습니다. (공개 자료 ${result.corpus.publishedMaterials}건 연결)`
    body.append(status)
  }
  return references
}

async function runTurn({ prompt, history, message }) {
  if (!model.value) throw new Error(modelLoadError || '사용 가능한 답변 모델을 불러오지 못했습니다. 모델 목록을 다시 확인해 주세요.')
  const result = await window.advisor.ask(prompt, history, model.value, assessmentContext)
  const references = appendSources(message.body, result)
  const answer = renderAdvisorAnswer(result.answer, references)
  message.paragraph.replaceWith(answer)
  message.paragraph = answer
  conversation = [...history, { role: 'user', content: prompt }, { role: 'assistant', content: result.answer }]
  failedTurn = null
  showError('')
  transcript.scrollTop = transcript.scrollHeight
}

function startAssessmentConsult() {
  if (!signedIn || !pendingAssessmentContext || busy) return
  assessmentContext = pendingAssessmentContext
  pendingAssessmentContext = ''
  conversation = []
  transcript.replaceChildren()
  addMessage('assistant', '자가점검 결과를 받았습니다. 보완이 필요한 항목을 살펴보고, 최신 웹 자료와 국제요정 안내서를 함께 확인해 우선 준비할 일을 안내하겠습니다.')
  question.value = '자가점검 결과를 바탕으로 보완이 필요한 항목을 지역별로 정리하고, 가장 먼저 준비할 일부터 쉬운 말로 안내해 주세요.'
  updateControls()
  form.requestSubmit()
}

async function receiveAssessmentConsult() {
  const context = await window.advisor.takeAssessment()
  if (typeof context !== 'string' || !context) return
  pendingAssessmentContext = context
  if (signedIn) startAssessmentConsult()
  else {
    transcript.replaceChildren()
    addMessage('assistant', '자가점검 결과를 불러왔습니다. ChatGPT 계정을 연결하면 이 결과를 바탕으로 상담을 시작합니다.')
  }
}

async function refresh() {
  const state = await window.advisor.status()
  signedIn = Boolean(state.signedIn)
  modelLoadError = ''
  status.textContent = !state.storageAvailable
    ? '이 기기에서 안전한 OS 보안 저장소를 사용할 수 없습니다.'
    : state.signedIn ? `ChatGPT 계정이 연결되어 있습니다.${state.account ? ` · ${state.account}` : ''}` : 'ChatGPT 계정을 연결하면 대화를 시작할 수 있습니다.'
  connect.disabled = !state.storageAvailable || busy
  connect.hidden = signedIn
  disconnect.hidden = !signedIn
  if (signedIn) {
    try {
      const available = await window.advisor.models()
      const previous = model.value
      model.replaceChildren()
      if (!available.length) {
        const option = document.createElement('option')
        option.value = ''
        option.textContent = '현재 계정에서 사용할 수 있는 GPT 모델이 없습니다'
        model.append(option)
      }
      available.forEach(item => {
        const option = document.createElement('option')
        option.value = item.id
        option.textContent = item.label
        model.append(option)
      })
      if (available.some(item => item.id === previous)) model.value = previous
      else if (available.length) model.value = available[0].id
      else model.value = ''
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes('연결이 만료')) signedIn = false
      modelLoadError = cause instanceof Error ? cause.message : String(cause)
      showError(`답변 모델 목록을 불러오지 못했습니다. ${modelLoadError}`)
    }
  }
  updateControls()
}

connect.addEventListener('click', async () => {
  showError('')
  connect.disabled = true
  try {
    const result = await window.advisor.connect()
    if (!result.ok) showError(result.message)
    await refresh()
    startAssessmentConsult()
  } catch (cause) {
    showError(cause instanceof Error ? cause.message : String(cause))
  } finally {
    connect.disabled = false
  }
})

disconnect.addEventListener('click', async () => {
  showError('')
  await window.advisor.disconnect()
  conversation = []
  assessmentContext = ''
  pendingAssessmentContext = ''
  transcript.replaceChildren()
  addMessage('assistant', 'ChatGPT 연결이 끊겼습니다. 다시 연결하면 새 대화를 시작할 수 있습니다.')
  await refresh()
})

form.addEventListener('submit', async event => {
  event.preventDefault()
  const prompt = question.value.trim()
  if (!prompt || !signedIn || busy) return
  if (!model.value) {
    showError(`답변 모델을 선택할 수 없습니다. ${modelLoadError || '사용 가능한 모델 목록이 비어 있습니다.'}`)
    return
  }
  const history = conversation.slice()
  addMessage('user', prompt)
  const reply = addMessage('assistant', '국제요정 자료를 살펴보고 답변을 준비하고 있습니다…')
  reply.paragraph.classList.add('typing')
  question.value = ''
  busy = true
  updateControls()
  showError('')
  failedTurn = { prompt, history, message: reply }
  try {
    await runTurn(failedTurn)
  } catch (cause) {
    reply.paragraph.classList.remove('typing')
    reply.paragraph.textContent = '답변을 만들지 못했습니다. 연결이나 선택한 기능을 확인한 뒤 다시 시도해 주세요.'
    const detail = cause instanceof Error ? cause.message : String(cause)
    showError(detail)
  } finally {
    reply.paragraph.classList.remove('typing')
    busy = false
    updateControls()
  }
})

question.addEventListener('input', updateControls)
question.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault()
    form.requestSubmit()
  }
})

newChat.addEventListener('click', () => {
  conversation = []
  assessmentContext = ''
  pendingAssessmentContext = ''
  failedTurn = null
  transcript.replaceChildren()
  addMessage('assistant', '새 대화를 시작합니다. 어떤 점이 궁금하신가요? 국가·지역과 회사 상황을 함께 적어 주시면 더 정확하게 답할 수 있습니다.')
  showError('')
  question.focus()
})

window.advisor.onAssessmentHandoff(() => void receiveAssessmentConsult().catch(cause => showError(cause instanceof Error ? cause.message : String(cause))))
void refresh().then(receiveAssessmentConsult).catch(cause => showError(cause instanceof Error ? cause.message : String(cause)))
