import robotsModule from "npm:robots-parser@3.0.1";
type Robots = {
  isAllowed: (url: string, agent: string) => boolean | undefined;
  getCrawlDelay: (agent: string) => number | undefined;
};
const robotsParser = robotsModule as unknown as (
  url: string,
  body: string,
) => Robots;
import { canonical } from "./adapter.ts";
import { requestTimeoutMs } from "./http-timeout.mjs";
export class OfficialHTTP {
  private robot: ReturnType<typeof robotsParser> | undefined;
  private last = 0;
  private interval = 2000;
  private requests = 0;
  constructor(readonly hosts: string[]) {}
  async request(
    raw: string,
    method = "GET",
    body?: string,
    robots = true,
  ): Promise<{ bytes: Uint8Array; url: string; type: string }> {
    let url = canonical(raw, this.hosts);
    if (robots && !this.robot) {
      const r = await this.request(
        new URL("/robots.txt", url).href,
        "GET",
        undefined,
        false,
      );
      this.robot = robotsParser(
        new URL("/robots.txt", url).href,
        new TextDecoder().decode(r.bytes),
      );
      this.interval = Math.max(
        2000,
        (this.robot.getCrawlDelay("GlobalTrendResearch") || 0) * 1000,
      );
    }
    for (let hop = 0; hop < 6; hop++) {
      url = canonical(url, this.hosts);
      if (
        robots && this.robot?.isAllowed(url, "GlobalTrendResearch") === false
      ) throw new Error("robots_disallowed");
      if (++this.requests > 12) throw new Error("request_budget");
      await new Promise((r) =>
        setTimeout(r, Math.max(0, this.last + this.interval - Date.now()))
      );
      this.last = Date.now();
      const r = await fetch(url, {
        method,
        body,
        headers: {
          "User-Agent":
            "GlobalTrendResearch/0.1 (+https://github.com/parksunup/globaltrend)",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        redirect: "manual",
        signal: AbortSignal.timeout(requestTimeoutMs(url)),
      });
      if ([301, 302, 303, 307, 308].includes(r.status)) {
        const loc = r.headers.get("location");
        await r.body?.cancel();
        if (!loc) throw new Error("redirect_location_missing");
        const u = new URL(loc, url);
        if (u.protocol === "http:" && this.hosts.includes(u.hostname)) {
          u.protocol = "https:";
        }
        url = canonical(u.href, this.hosts);
        if (
          r.status === 303 || [301, 302].includes(r.status) && method === "POST"
        ) {
          method = "GET";
          body = undefined;
        }
        continue;
      }
      if (!r.ok) {
        await r.body?.cancel();
        throw new Error("http_" + r.status);
      }
      if (Number(r.headers.get("content-length") || 0) > 2000000) {
        await r.body?.cancel();
        throw new Error("response_size_limit");
      }
      const reader = r.body?.getReader();
      if (!reader) throw new Error("empty_response");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2000000) {
          await reader.cancel();
          throw new Error("response_size_limit");
        }
        chunks.push(value);
      }
      if (!size) throw new Error("empty_response");
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return {
        bytes,
        url,
        type: (r.headers.get("content-type") || "").split(";")[0],
      };
    }
    throw new Error("redirect_limit");
  }
}
