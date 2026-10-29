"""Normalize observed official web documents; no network or database side effects.

The scheduled agent supplies complete article text from web open, not a search
snippet. The server validates the same source/date/evidence contract again.
"""
import argparse
import datetime as dt
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
ROUTES = json.loads((ROOT / 'config/collector-web.json').read_text())
CHALLENGE = re.compile(r"^\s*(?:verify that you.re not a robot|in order to continue, we need to verify|enable javascript|access denied|checking your browser|complete the captcha|javascript is disabled)", re.I)


def normalize_document(source, document, since, until):
    config = ROUTES[source]
    start, end = dt.date.fromisoformat(since), dt.date.fromisoformat(until)
    if (end-start).days != 2 or end > dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date():
        raise ValueError('three_calendar_day_window_required')
    url = document['url']
    parsed = urlsplit(url)
    if parsed.username or parsed.password or parsed.port or parsed.query or parsed.fragment or re.search(r'%|/\.\.?(/|$)|[\\\s]', url):
        raise ValueError('canonical_official_url_required')
    if not any(re.fullmatch(route, url) for route in config['routes']):
        raise ValueError('official_article_path_required')
    day = dt.date.fromisoformat(document['published_date'])
    if not start <= day <= end:
        raise ValueError('publication_date_outside_window')
    title, body = document['title'].strip(), document['body'].strip()
    if not 1 <= len(title) <= 1000 or not 100 <= len(body.encode()) <= 400000 or CHALLENGE.search(body):
        raise ValueError('verified_article_body_required')
    evidence = document['evidence']
    if evidence.get('complete_body') is not True or not all(isinstance(evidence.get(k), str) and evidence[k].strip() for k in ('ref','publication_locator','body_locator','accessed_at')):
        raise ValueError('complete_body_evidence_required')
    accessed = dt.datetime.fromisoformat(evidence['accessed_at'].replace('Z','+00:00'))
    if accessed.tzinfo is None or accessed > dt.datetime.now(dt.timezone.utc)+dt.timedelta(minutes=5):
        raise ValueError('actual_access_time_required')
    if source == 'hk-pcpd' and (evidence.get('issuer') != 'Office of the Privacy Commissioner for Personal Data' or not evidence.get('issuer_locator') or not re.search(r'privacy commissioner|\bPCPD\b', body, re.I)):
        raise ValueError('pcpd_issuer_evidence_required')
    scope = document['read_scope']
    if not (scope == 'official_full_article' and evidence.get('method') == 'web_open'):
        raise ValueError('full_official_article_required')
    if evidence.get('linked_content_verified') is False:
        raise ValueError('linked_content_unverified')
    needs_review = False
    metadata = dict(collector_executor='chatgpt-web',read_scope=scope,web_evidence=evidence,
                    published_date_evidence=dict(value=day.isoformat(),locator=evidence['publication_locator']),
                    ai_ready=not needs_review,requires_review=needs_review,coverage_complete=False)
    return dict(p_source_id=config['source_id'],p_external_id=None,p_canonical_url=url,p_title_original=title,
                p_published_at=day.isoformat()+'T00:00:00Z',p_event_date=None,p_fetched_at=evidence['accessed_at'],
                p_language_code='en',p_document_type='press_release',p_content_text=body,
                p_content_hash=hashlib.sha256(body.encode()).hexdigest(),p_raw_storage_path=None,
                p_metadata=metadata,p_instruction_version='trend-ko-v1')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', choices=ROUTES)
    parser.add_argument('input', type=Path)
    parser.add_argument('--since', required=True)
    parser.add_argument('--until', required=True)
    args=parser.parse_args()
    document=json.loads(args.input.read_text())
    normalize_document(args.source,document,args.since,args.until)
    print(json.dumps(dict(p_slug=args.source,p_document=dict(document,since=args.since,until=args.until)),ensure_ascii=False))

if __name__ == '__main__':
    main()
