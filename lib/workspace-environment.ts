/** Vercel provides a project production hostname; never derive it from a Preview URL. */
export function productionWorkspaceOrigin(host: string | undefined): string | undefined {
  if (!host?.trim()) return undefined;
  try {
    const url = new URL(host.includes('://') ? host : `https://${host}`);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.origin;
  } catch { return undefined; }
}
