export interface FreeConnectPage {
  lang: string
  title: string
  body: string
}

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] ?? char))

/** Small local callback page adapter; all supplied text is escaped. */
export function freeConnectPageHtml(page: FreeConnectPage): string {
  return `<!doctype html><html lang="${escapeHtml(page.lang)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(page.title)}</title><body><main><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.body)}</p><p>You may close this browser tab and return to GlobalTrend.</p></main></body></html>`
}
