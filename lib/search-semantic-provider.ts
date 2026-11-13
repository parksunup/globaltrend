import type { SearchDocument, SemanticHit } from './unified-search';
export type SemanticState = 'off' | 'active' | 'unavailable';
/** Optional, operator-controlled encoder. No default external service or paid API. */
export async function semanticSearch(query: string, documents: SearchDocument[], options: {
    url?: string;
    token?: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
} = {}): Promise<{
    state: SemanticState;
    hits: SemanticHit[];
}> {
    const endpoint = options.url ?? process.env.PUBLIC_SEARCH_EMBEDDING_URL;
    if (!endpoint)
        return { state: 'off', hits: [] };
    try {
        const url = new URL(endpoint);
        if (url.username || url.password || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))))
            return { state: 'unavailable', hits: [] };
        const text = JSON.stringify({ query, documents: documents.map(d => ({ id: d.id, text: [d.title, d.lawTitle, d.tags.join(' '), d.text].filter(Boolean).join('\n') })) });
        if (Buffer.byteLength(text) > 6000000)
            return { state: 'unavailable', hits: [] };
        const token = options.token ?? process.env.PUBLIC_SEARCH_EMBEDDING_TOKEN;
        const response = await (options.fetch ?? fetch)(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: text, cache: 'no-store', signal: AbortSignal.timeout(options.timeoutMs ?? 2500), redirect: 'error' });
        if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 200000)
            return { state: 'unavailable', hits: [] };
        const reader = response.body?.getReader();
        if (!reader)
            return { state: 'unavailable', hits: [] };
        const decoder = new TextDecoder();
        let raw = '', size = 0;
        try {
            for (;;) {
                const chunk = await reader.read();
                if (chunk.done)
                    break;
                size += chunk.value.byteLength;
                if (size > 200000) {
                    await reader.cancel();
                    return { state: 'unavailable', hits: [] };
                }
                raw += decoder.decode(chunk.value, { stream: true });
            }
            raw += decoder.decode();
        }
        finally {
            reader.releaseLock();
        }
        const data = JSON.parse(raw) as {
            hits?: unknown;
        };
        if (!Array.isArray(data.hits))
            return { state: 'unavailable', hits: [] };
        const ids = new Set(documents.map(d => d.id));
        const hits: SemanticHit[] = [];
        for (const value of data.hits.slice(0, 200)) {
            if (!value || typeof value !== 'object')
                continue;
            const hit = value as SemanticHit;
            if (ids.has(hit.id) && typeof hit.score === 'number' && Number.isFinite(hit.score) && hit.score >= .75 && hit.score <= 1)
                hits.push({ id: hit.id, score: hit.score });
        }
        return { state: 'active', hits };
    }
    catch {
        return { state: 'unavailable', hits: [] };
    }
}
