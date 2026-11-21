export class AiRunError extends Error {
  readonly kind: string
  readonly provider?: string

  constructor(kind: string, message: string, detail: { provider?: string } = {}) {
    super(message)
    this.name = 'AiRunError'
    this.kind = kind
    this.provider = detail.provider
  }
}
