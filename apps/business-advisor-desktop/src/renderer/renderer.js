const status = document.querySelector('#status')
const connect = document.querySelector('#connect')
const disconnect = document.querySelector('#disconnect')
const ask = document.querySelector('#ask')
const question = document.querySelector('#question')
const answer = document.querySelector('#answer')
const citations = document.querySelector('#citations')
const error = document.querySelector('#error')
const jurisdictionInputs = [...document.querySelectorAll('input[name="jurisdiction"]')]

function selectedJurisdictions() {
  return jurisdictionInputs.filter(input => input.checked).map(input => input.value)
}

function updateAskButton(signedIn) {
  ask.disabled = !signedIn || selectedJurisdictions().length === 0
}

function showError(message) {
  error.textContent = message
  error.hidden = !message
}

async function refresh() {
  const state = await window.advisor.status()
  status.textContent = !state.storageAvailable
    ? '이 기기에서 OS 보안 저장소를 사용할 수 없어 로그인 연결을 진행할 수 없습니다.'
    : state.signedIn ? 'ChatGPT 계정이 연결되어 있습니다.' : 'ChatGPT 계정이 연결되지 않았습니다.'
  connect.disabled = !state.storageAvailable
  connect.hidden = Boolean(state.signedIn)
  disconnect.hidden = !state.signedIn
  updateAskButton(state.signedIn)
}

connect.addEventListener('click', async () => {
  showError('')
  connect.disabled = true
  try {
    const result = await window.advisor.connect()
    if (!result.ok) showError(result.message)
    await refresh()
  } catch (cause) {
    showError(cause instanceof Error ? cause.message : String(cause))
  } finally {
    connect.disabled = false
  }
})

disconnect.addEventListener('click', async () => {
  showError('')
  await window.advisor.disconnect()
  answer.textContent = ''
  citations.replaceChildren()
  citations.hidden = true
  await refresh()
})

ask.addEventListener('click', async () => {
  showError('')
  answer.textContent = '발행된 법령 근거를 확인하고 있습니다…'
  citations.replaceChildren()
  citations.hidden = true
  const jurisdictions = selectedJurisdictions()
  updateAskButton(false)
  try {
    const result = await window.advisor.ask(question.value, jurisdictions)
    answer.textContent = `${result.answer}\n\n사용 모델: ${result.model}\n${result.notice}`
    result.evidence.forEach((source, index) => {
      const article = document.createElement('article')
      const title = document.createElement('strong')
      title.textContent = `[${index + 1}] ${source.jurisdictionName} · ${source.lawTitle} · ${source.sectionTitle}`
      const version = document.createElement('p')
      version.textContent = `판본: ${source.version} · 상태: ${source.reviewStatus === 'official' ? '공식 자료' : '발행 완료'}`
      const open = document.createElement('button')
      open.type = 'button'
      open.className = 'source-button'
      open.textContent = '공식 원문 열기 ↗'
      open.addEventListener('click', () => void window.advisor.openSource(source.officialUrl))
      article.append(title, version, open)
      citations.append(article)
    })
    citations.hidden = result.evidence.length === 0
  } catch (cause) {
    answer.textContent = ''
    citations.replaceChildren()
    citations.hidden = true
    showError(cause instanceof Error ? cause.message : String(cause))
  } finally {
    await refresh()
  }
})

jurisdictionInputs.forEach(input => input.addEventListener('change', () => {
  void window.advisor.status().then(state => updateAskButton(state.signedIn))
}))

void refresh().catch((cause) => showError(cause instanceof Error ? cause.message : String(cause)))
