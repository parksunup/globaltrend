export interface AiFetchWatch {
  onResend?: ((why: 'failed' | 'busy' | 'blocked') => void) | undefined
}

/** Local adapter for IeumOffice's injectable fetch contract. */
export async function aiFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init)
}
