import { OfficialHTTP } from "./http.ts";
import { discover, extract } from "./adapter.ts";
import {
  detailRequestUrl,
  isExpansion,
  verifyDetailResponse,
} from "./expansion.ts";

// Fixed public routes only. No caller-provided URL, database access or writes.
export const expansionCandidates: Record<string, string> = {
  edps: "https://www.edps.europa.eu/press-publications/press-news/news_en",
  ec:
    "https://ec.europa.eu/commission/presscorner/api/latestnews?language=en&pagesize=100&pagenumber=1",
  calprivacy: "https://privacy.ca.gov/about-us/newsroom/",
  oaic: "https://www.oaic.gov.au/news/media-centre",
  "ca-opc": "https://www.priv.gc.ca/en/opc-news/news-and-announcements/",
  "hk-pcpd":
    "https://www.pcpd.org.hk/english/news_events/media_statements/index.html",
  "eu-parliament":
    "https://www.europarl.europa.eu/rss/doc/press-releases/en.xml",
  "eu-council": "https://www.consilium.europa.eu/en/press/press-releases/",
  "eur-lex": "https://eur-lex.europa.eu/content/news/index.html",
  "cn-cac": "https://www.cac.gov.cn/wxzw/A0937index_1.htm",
  "cn-tc260": "https://www.tc260.org.cn/tc260/tzgg/list.shtml",
};

export async function probe(source: string) {
  const url = expansionCandidates[source];
  if (!url) throw new Error("unknown_probe_source");
  const started = Date.now();
  let stage = "listing_fetch";
  try {
    const http = new OfficialHTTP([new URL(url).hostname]);
    const response = await http.request(url);
    const text = new TextDecoder().decode(response.bytes);
    let parsed: Record<string, unknown> = {};
    if (isExpansion(source)) {
      stage = "listing_parse";
      const found = discover(source, text, response.url);
      const sample = found.rows[0];
      stage = "detail_fetch";
      const detail = await http.request(detailRequestUrl(source, sample.url));
      verifyDetailResponse(source, sample.url, detail.url);
      stage = "detail_parse";
      const item = await extract(
        source,
        new TextDecoder().decode(detail.bytes),
        sample.url,
        sample,
      );
      parsed = {
        rows: found.rows.length,
        next: found.next,
        sample_url: sample.url,
        title: item.title_original,
        published_date: item.published_date,
        body_chars: item.content_text.length,
        read_scope: item.metadata.read_scope,
        parser_verified: !!item.published_date,
      };
    }
    return {
      source,
      url: response.url,
      status: "fetched",
      type: response.type,
      bytes: response.bytes.length,
      title: (text.match(/<title[^>]*>([^<]*)/i)?.[1] || "").slice(0, 200),
      bot_challenge: /EO_Bot_Ssid|__tst_status/.test(text),
      ...parsed,
      elapsed_ms: Date.now() - started,
      writes_performed: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_failure";
    return {
      source,
      url,
      stage,
      status: "failed",
      reason: /^[a-z_0-9]+$/i.test(message) ? message : "network_failure",
      elapsed_ms: Date.now() - started,
      writes_performed: false,
    };
  }
}
