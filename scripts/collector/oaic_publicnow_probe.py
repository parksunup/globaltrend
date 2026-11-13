"""Read-only cloud checks of OAIC and PublicNow routes; performs no DB writes."""
import json
import re

from bs4 import BeautifulSoup

from . import expansion, parsers
from .core import FetchError, HttpClient

OFFICIAL_LISTING = 'https://www.oaic.gov.au/news/media-centre'
PUBLICNOW_LISTING = 'https://www.publicnow.com/source/91701'
EBS_LISTING = 'https://ebs.publicnow.com/source/91701'
EBS_SAMPLE = 'https://ebs.publicnow.com/view/B59310CD64A996972D53A2015CCFCB8283E3E9C6'
HOSTS = ['www.oaic.gov.au', 'www.publicnow.com', 'ebs.publicnow.com']


def inspect_publicnow_detail(html, url):
    soup = BeautifulSoup(html, 'html.parser')
    title = soup.select_one('main h1,article h1,h1')
    body = soup.select_one('article .article-content,article .content,main article,main')
    visible = soup.get_text(' ', strip=True)
    return {
        'url': url,
        'title_present': bool(title and title.get_text(' ', strip=True)),
        'body_characters': len(body.get_text(' ', strip=True)) if body else 0,
        'oaic_attribution': bool(re.search(r'Office of the Australian Information Commissioner', visible, re.I)),
        'publisher_attribution': bool(re.search(r'Public Technologies', visible, re.I)),
    }


def run_official(client):
    result = {'route': OFFICIAL_LISTING, 'status': 'failed', 'candidate_count': 0}
    try:
        data, listing_url, _ = client.get(OFFICIAL_LISTING)
        rows, next_url = parsers.discover_listing('oaic', data.decode('utf-8', 'replace'), listing_url, lambda *args: (_ for _ in ()).throw(RuntimeError('unexpected_fetch')))
        result.update(candidate_count=len(rows), next_url_present=bool(next_url), listing_url=listing_url)
        if not rows:
            result['error'] = 'no_validated_candidates'
            return result
        row = rows[0]
        detail, detail_url, _ = client.get(row['url'])
        extracted = parsers.extract('oaic', detail.decode('utf-8', 'replace'), detail_url)
        result['detail'] = {'url': detail_url, 'title_present': bool(extracted.get('title_original')),
                            'body_characters': len(extracted.get('content_text', ''))}
        result['status'] = 'passed' if result['detail']['title_present'] and result['detail']['body_characters'] >= 80 else 'failed_validation'
    except (FetchError, ValueError, KeyError, IndexError, RuntimeError) as exc:
        result['error'] = str(exc)[:200]
    return result


def run_archive(client, archive_url):
    result = {'route': archive_url, 'status': 'failed', 'candidate_count': 0}
    try:
        data, listing_url, _ = client.get(archive_url)
        html = data.decode('utf-8', 'replace')
        if listing_url.startswith('https://ebs.publicnow.com/'):
            soup = BeautifulSoup(html, 'html.parser')
            rows = []
            for anchor in soup.select('a[href*="/view/"]'):
                match = re.search(r'/view/([A-Fa-f0-9]{40})$', anchor.get('href', ''))
                title = anchor.get_text(' ', strip=True)
                if match and title:
                    rows.append({'url': 'https://ebs.publicnow.com/view/' + match.group(1), 'title': title})
            rows = list({row['url']: row for row in rows}.values())
        else:
            rows, _ = expansion.discover('oaic', html, listing_url)
        result.update(candidate_count=len(rows), listing_url=listing_url)
        row = rows[0]
        detail, detail_url, _ = client.get(row['url'])
        detail_html = detail.decode('utf-8', 'replace')
        result['detail'] = inspect_publicnow_detail(detail_html, detail_url)
        if 'www.publicnow.com' in detail_url:
            item = expansion.extract('oaic', detail_html, detail_url, row)
            result['detail']['parsed_body_characters'] = len(item.get('content_text', ''))
        else:
            result['detail']['parsed_body_characters'] = result['detail']['body_characters']
        result['status'] = 'passed' if result['detail']['title_present'] and result['detail']['parsed_body_characters'] >= 80 and result['detail']['oaic_attribution'] and result['detail']['publisher_attribution'] else 'failed_validation'
    except (FetchError, ValueError, KeyError, IndexError) as exc:
        result['error'] = str(exc)[:200]
    return result


def run_ebs_sample(client):
    result = {'route': EBS_SAMPLE, 'status': 'failed'}
    try:
        data, detail_url, _ = client.get(EBS_SAMPLE)
        detail = inspect_publicnow_detail(data.decode('utf-8', 'replace'), detail_url)
        result['detail'] = detail
        result['status'] = 'content_present' if detail['title_present'] and detail['body_characters'] >= 80 and detail['oaic_attribution'] and detail['publisher_attribution'] else 'failed_validation'
    except FetchError as exc:
        result['error'] = str(exc)[:200]
    return result


def main():
    with HttpClient(HOSTS, interval=6) as client:
        results = [run_official(client), run_archive(client, PUBLICNOW_LISTING),
                   run_archive(client, EBS_LISTING), run_ebs_sample(client)]
        robots_unavailable = client.robots_unavailable
    output = {'results': results, 'robots_unavailable': robots_unavailable,
              'database_writes': 0, 'request_interval_seconds': 6}
    print(json.dumps(output, ensure_ascii=False, sort_keys=True))
    try:
        import os
        summary_path = os.environ.get('GITHUB_STEP_SUMMARY')
        if summary_path:
            with open(summary_path, 'a', encoding='utf-8') as summary:
                summary.write('## OAIC read-only route probe\n\n```json\n')
                summary.write(json.dumps(output, ensure_ascii=False, indent=2))
                summary.write('\n```\n')
    except OSError:
        pass


if __name__ == '__main__':
    main()
