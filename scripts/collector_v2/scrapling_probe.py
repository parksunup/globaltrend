"""Read-only Scrapling comparison for OECD's approved listing and one article.

No DB credentials or writes; this is not a production collector.
"""
import json
import os
import time
from pathlib import Path
from urllib.parse import urljoin
from scrapling.fetchers import Fetcher
from scripts.collector import parsers
from scripts.collector.core import FetchError, HttpClient, canonical_url, fetch_listing


class ProbeClient:
    def __init__(self, hosts):
        self.hosts = set(hosts)
        self.guard = HttpClient(hosts, interval=2)
        self.last = 0.0

    def get(self, url):
        for _ in range(6):
            url = self.guard.check_robots(canonical_url(url, self.hosts))
            time.sleep(max(0, self.last + self.guard.interval - time.monotonic()))
            self.last = time.monotonic()
            response = Fetcher.get(url, headers={'User-Agent': 'GlobalTrendResearch/0.1 (+https://github.com/parksunup/globaltrend)', 'Referer': None},
                                   impersonate='chrome' if os.getenv('SCRAPLING_CHROME_TLS') == '1' else None,
                                   stealthy_headers=False, timeout=20, retries=0, follow_redirects=False)
            if response.status in (301, 302, 303, 307, 308):
                location = response.headers.get('location')
                if not location:
                    raise FetchError('redirect_location_missing')
                url = canonical_url(urljoin(url, location), self.hosts)
                continue
            if response.status != 200:
                raise FetchError('http_' + str(response.status))
            if len(response.body) > 2_000_000:
                raise FetchError('response_size_limit')
            return response.body, str(response.url), response.headers.get('content-type', '').split(';')[0].lower()
        raise FetchError('redirect_limit')

    def post(self, url, payload, headers):
        raise FetchError('post_not_supported_in_probe')


def main():
    if os.getenv('SCRAPLING_FTC_ROBOTS') == '1':
        response = Fetcher.get('https://www.ftc.gov/robots.txt',
                               headers={'User-Agent': 'GlobalTrendResearch/0.1 (+https://github.com/parksunup/globaltrend)', 'Referer': None},
                               stealthy_headers=False, timeout=20, retries=0, follow_redirects=False)
        print(json.dumps({'source': 'ftc', 'robots_status': response.status,
                          'bytes': len(response.body), 'writes_performed': False}))
        if response.status != 200:
            raise FetchError('robots_http_' + str(response.status))
        return
    registry = json.loads((Path(__file__).resolve().parents[2] / 'config/trend-collector.json').read_text(encoding='utf-8'))
    config = next(c for c in registry['sources'] if c['source'] == 'oecd')
    client = ProbeClient(config['hosts'])
    listing = ('https://www.oecd.org/en/topics/policy-issues/privacy-and-data-protection.html'
               if os.getenv('SCRAPLING_OECD_ALTERNATE') == '1' else config['listing'])
    rows, _ = fetch_listing('oecd', client, listing)
    if not rows:
        raise ValueError('listing_empty')
    body, url, content_type = client.get(rows[0]['url'])
    item = parsers.extract_document('oecd', body, url, content_type, rows[0])
    print(json.dumps({'source': 'oecd', 'status': 'parsed_sample', 'url': url,
                      'characters': len(item['content_text']), 'published_date': item['published_date'],
                      'coverage_complete': False, 'writes_performed': False}))


if __name__ == '__main__':
    main()
