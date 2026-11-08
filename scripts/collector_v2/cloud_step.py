"""Crawlee transport adapter for the existing atomic collector claim contract."""
import hashlib
import re
from datetime import datetime, timezone

from scripts.collector import cloud_step as legacy
from scripts.collector import parsers
from scripts.collector.core import FetchError
from scripts.collector_v2.extraction import fallback_main_text
from scripts.collector_v2.transport import CrawleeClient
from urllib.parse import urlsplit


def supplement_official_pdf(item, source, client):
    """Read one known-host PDF while retaining explicit review and provenance."""
    if source not in ('ppc', 'cn-tc260'):
        return item
    metadata = item['metadata']
    attachments = metadata.get('related_documents', [])
    for attachment in attachments:
        target = attachment.get('url', '')
        if not urlsplit(target).path.lower().endswith('.pdf') or urlsplit(target).hostname not in client.hosts:
            continue
        try:
            body, final, content_type = client.get(target)
            if content_type != 'application/pdf' or not body.startswith(b'%PDF-'):
                raise ValueError('attachment_not_pdf')
            pdf = parsers.extract_pdf(body, final)
            text = '\n'.join(page['text'] for page in pdf['pages'])
            combined = item['content_text'] + '\n\n[Official PDF attachment]\n' + text
            item['content_text'] = combined
            item['content_hash'] = hashlib.sha256(combined.encode('utf-8')).hexdigest()
            attachment['read'] = True
            metadata['unread_attachments'] = [u for u in metadata.get('unread_attachments', []) if u != target]
            metadata['related_documents'].extend(pdf['related_documents'])
            metadata['unread_attachments'].extend(link['url'] for link in pdf['related_documents'])
            metadata['pdf_text_attachment'] = {'url': final, 'pages': len(pdf['pages']), 'visual_review': False}
        except (FetchError, ValueError) as error:
            metadata['pdf_attachment_failure'] = str(error)[:120]
        metadata['requires_review'] = True
        metadata['ai_ready'] = False
        break
    return item


def prepare(claim, *, browser_hosts=()):
    """Prepare one existing cloud claim; does not commit or alter DB state."""
    original_client = legacy.HttpClient
    original_extract = parsers.extract_document
    clients = []

    def client_factory(hosts, interval=2, budget=None):
        client = CrawleeClient(hosts, browser_hosts=browser_hosts, interval=interval, budget=budget)
        clients.append(client)
        return client

    def extract_with_fallback(source, body, url, content_type, row=None):
        try:
            item = original_extract(source, body, url, content_type, row)
            if clients:
                item = supplement_official_pdf(item, source, clients[-1])
            # A short page can be a legitimate notice, but it can also be a
            # landing page whose actual document is an attachment. Do not
            # silently substitute a different extraction or mark it AI-ready.
            if len(item.get('content_text', '').strip()) < 300:
                item['metadata']['requires_review'] = True
                item['metadata']['short_body_review'] = True
                item['metadata']['ai_ready'] = False
            return item
        except (ValueError, UnicodeError) as error:
            if content_type not in ('text/html', 'application/xhtml+xml'):
                raise
            candidate = fallback_main_text(body)
            if candidate is None:
                raise error
            text = candidate['content_text']
            title = (row or {}).get('title') or 'Unverified official page'
            return {'title_original': title, 'content_text': text,
                    'content_hash': hashlib.sha256(text.encode('utf-8')).hexdigest(),
                    'published_date': None,
                    'metadata': {'normalization_version': 'collector-v2-trafilatura-fallback',
                        'parser_version': 'trafilatura-2.3.1', 'read_scope': 'trafilatura_main_text_fallback',
                        'requires_review': True, 'ai_ready': False,
                        'date_observations': [], 'unread_attachments': [],
                        'fallback_error': str(error)[:160],
                        'relevance_reason': 'full_body_available_human_relevance_review_pending'}}

    legacy.HttpClient = client_factory
    parsers.extract_document = extract_with_fallback
    try:
        return legacy.prepare(claim)
    finally:
        legacy.HttpClient = original_client
        parsers.extract_document = original_extract


def main():
    import argparse, json
    from pathlib import Path
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--claim', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--browser-host', action='append', default=[])
    args = parser.parse_args()
    bundle = prepare(json.loads(Path(args.claim).read_text(encoding='utf-8')),
                     browser_hosts=args.browser_host)
    path = Path(args.output); path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'result': bundle['result'], 'operations': len(bundle['operations']),
                      'saved': False}, ensure_ascii=False))


if __name__ == '__main__':
    main()
