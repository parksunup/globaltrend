const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const CNIL_REQUEST_TIMEOUT_MS = 30_000;

export function requestTimeoutMs(rawUrl) {
  const hostname = new URL(rawUrl).hostname.toLowerCase();
  return hostname === "www.cnil.fr"
    ? CNIL_REQUEST_TIMEOUT_MS
    : DEFAULT_REQUEST_TIMEOUT_MS;
}
