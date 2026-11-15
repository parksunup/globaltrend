"""Read-only Crawlee + Trafilatura probe for the complete source catalog.

Trafilatura is attempted first for article body extraction. The existing
source-specific adapter is consulted only after that attempt for verified date
and other source metadata; its body is used only when Trafilatura cannot
produce a usable body. New catalog sources use a conservative HTML/feed
candidate parser. The probe never writes to Supabase.
"""
import argparse
import asyncio
import email.utils
import hashlib
import json
import logging
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup
from crawlee import Request
from crawlee.crawlers import HttpCrawler
from crawlee.http_clients import HttpxHttpClient
from trafilatura import extract, extract_metadata

from scripts.collector import expansion, parsers
from scripts.collector.core import FetchError, fetch_listing
from scripts.source_catalog import load_catalog

logging.getLogger('crawlee').setLevel(logging.CRITICAL)
USER_AGENT = 'GlobalTrendResearch/0.1 (+https://github.com/parksunup/globaltrend)'
PACE_LOCK = Lock()
PACE_BY_HOST = {}
ROBOTS = {}
ROBOTS_LOCK = Lock()
CRAWLEE_LOOP = asyncio.new_event_loop()


def _pace(host, delay):
    with PACE_LOCK:
        wait = PACE_BY_HOST.get(host, 0) - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        PACE_BY_HOST[host] = time.monotonic() + delay


def _robots_delay(host):
    with ROBOTS_LOCK:
        if host in ROBOTS:
            return ROBOTS[host]
    url = 'https://' + host + '/robots.txt'
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'text/plain,*/*;q=0.5'})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            lines = response.read().decode('utf-8', 'replace').splitlines()
    except urllib.error.HTTPError as error:
        # RFC 9309 treats 4xx as unavailable rules. A 429 and 5xx are a
        # temporary access signal; do not convert them into permission.
        if 400 <= error.code < 500 and error.code != 429:
            lines = []
        else:
            raise FetchError('robots_fetch_failed:http_' + str(error.code)) from None
    except Exception as error:
        raise FetchError('robots_fetch_failed:' + type(error).__name__) from None
    from protego import Protego
    parser = Protego.parse('\n'.join(lines))
    value = parser.crawl_delay('GlobalTrendResearch') or parser.crawl_delay('*') or 2
    with ROBOTS_LOCK:
        ROBOTS[host] = (parser, max(2, value))
    return ROBOTS[host]


class CrawleeClient:
    """Small synchronous bridge to the unmodified Crawlee HTTP crawler."""
    def __init__(self, hosts):
        self.hosts = set(hosts)
        self.requests = 0
        self.downloaded_bytes = 0
        self.last_http_status = None
        self.last_url = None
        # Crawlee keeps async primitives at module scope. Keep one loop for all
        # clients and sources in this process; a new loop per source/request
        # causes later requests to fail with "bound to a different event loop".
        self.loop = CRAWLEE_LOOP

    def close(self):
        # The process owns the shared loop and closes it once after the probe.
        pass

    def get(self, url):
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.hostname not in self.hosts or parsed.username or parsed.password:
            raise ValueError('url_outside_allowlisted_https_hosts')
        policy, delay = _robots_delay(parsed.hostname)
        if not policy.can_fetch(url, 'GlobalTrendResearch'):
            raise FetchError('robots_disallowed')
        _pace(parsed.hostname, delay)
        self.requests += 1
        self.last_http_status = None
        self.last_url = url
        result = {}

        async def run():
            crawler = HttpCrawler(
                http_client=HttpxHttpClient(header_generator=None),
                max_requests_per_crawl=1,
                max_request_retries=0,
                max_session_rotations=0,
                respect_robots_txt_file=False,
                configure_logging=False,
            )

            @crawler.router.default_handler
            async def handle(context):
                response = context.http_response
                result.update(body=await response.read(), url=context.request.loaded_url or context.request.url,
                              status=response.status_code,
                              content_type=response.headers.get('content-type', '').split(';')[0].lower())

            @crawler.failed_request_handler
            async def failed(context, error):
                match = re.search(r'(?:status code|status|HTTP)\s*[:=]?\s*(\d{3})\b', str(error), re.I)
                result['error'] = 'http_' + match.group(1) if match else 'crawlee_' + type(error).__name__
                result['error_details'] = str(error)[:500]
                if match:
                    result['status'] = int(match.group(1))
                result['url'] = context.request.loaded_url or context.request.url

            await crawler.run([Request.from_url(url, max_retries=0)])

        try:
            self.loop.run_until_complete(run())
        except Exception as error:
            raise FetchError('crawlee_' + type(error).__name__) from None
        if 'error' in result:
            self.last_http_status = result.get('status')
            self.last_url = result.get('url', url)
            raise FetchError(result['error'])
        if not result:
            raise FetchError('crawlee_request_skipped_or_failed')
        self.last_http_status = result['status']
        if result['status'] < 200 or result['status'] >= 400:
            raise FetchError('http_' + str(result['status']))
        final = urlsplit(result['url'])
        if final.scheme != 'https' or final.hostname not in self.hosts:
            raise ValueError('redirect_outside_allowlisted_https_hosts')
        self.downloaded_bytes += len(result['body'])
        self.last_url = result['url']
        return result['body'], result['url'], result['content_type']


GENERIC_LINK_LABELS = {'read more', 'read more »', 'continue reading', 'leer más', 'leer mas', 'more', 'continue', 'vietnamese', 'home'}
EXCLUDED_PATH_PARTS = ('/training', '/private-trainings', '/working-groups', '/projects.html',
                       '/cookies', '/cookie', '/privacy-policy', '/terms-of-use', '/contact',
                       '/subscribe', '/newsletter', '/membership', '/login')
SOURCE_ADAPTERS = {'edpb', 'oecd', 'curia', 'cnil', 'dpc', 'pdpc', 'ppc', 'ec',
                   'calprivacy', 'oaic', 'ca-opc', 'eu-council', 'cn-cac', 'cn-tc260', 'es-aepd', 'anpd-br',
                   'npc-ph', 'nl-ap', 'jpdp-my', 'global-cbpr', 'iso-iec-sc27', 'ico', 'g7-dpa',
                   'hk-pcpd', 'vn-gov', 'nist', 'iapp', 'fpf', 'gpa', 'noyb', 'freevacy', 'overview-legal'}
PRIVACY_SIGNAL_TERMS = (
    'privacy', 'personal data', 'personal information', 'data protection', 'gdpr',
    'persoonsgegevens', 'gegevensbescherming', 'données personnelles',
    'protection des données', 'protección de datos', 'datos personales',
    'proteção de dados', 'dados pessoais', '個人情報', '個人データ', '个人信息',
    '个人数据', '개인정보', '정보보호',
)


def _anchor_title(anchor):
    title = ' '.join(anchor.get_text(' ', strip=True).split())
    if title.casefold() not in GENERIC_LINK_LABELS:
        return title
    for parent in anchor.parents:
        if getattr(parent, 'name', None) in ('body', 'html'):
            break
        heading = parent.select_one('h1, h2, h3, h4, h5')
        if heading:
            candidate = ' '.join(heading.get_text(' ', strip=True).split())
            if candidate.casefold() not in GENERIC_LINK_LABELS and len(candidate) >= 10:
                return candidate
    return title


def filter_listing_rows(rows, source, rejection_counts=None):
    terms = [term.casefold() for term in source.get('topic_terms', [])]
    filtered = []
    rejected = rejection_counts if rejection_counts is not None else {}
    def reject(reason):
        rejected[reason] = rejected.get(reason, 0) + 1
    for row in rows:
        title = ' '.join(row.get('title', '').split())
        path = urlsplit(row['url']).path.casefold().rstrip('/') or '/'
        haystack = (title + ' ' + path + ' ' + row.get('feed_text', '')).casefold()
        if not title:
            reject('empty_title'); continue
        if title.casefold() in GENERIC_LINK_LABELS:
            reject('generic_title')
            continue
        if any(part in path for part in EXCLUDED_PATH_PARTS):
            reject('excluded_path')
            continue
        if path == '/' and source.get('id') in ('vn-gov', 'fpf', 'overview-legal'):
            reject('homepage_not_article')
            continue
        if source.get('id') == 'anpd-br' and path.endswith('/deliberacoes-do-conselho-diretor'):
            reject('non_news_route')
            continue
        # The FTC route itself is a privacy-tagged official search view. Its
        # result headlines frequently omit "privacy" even when the taxonomy
        # selected the result; applying a second lexical gate erased the page.
        if terms and not source.get('listing_is_topic_scoped') and not any(term in haystack for term in terms):
            reject('no_topic_term_match')
            continue
        filtered.append({**row, 'title': title})
    return filtered


def parse_listing(body, final_url, content_type, hosts):
    if content_type in ('application/rss+xml', 'application/atom+xml', 'application/xml', 'text/xml'):
        text = body.decode('utf-8', 'replace')
        if re.search(r'<!DOCTYPE|<!ENTITY', text, re.I):
            raise ValueError('xml_entities_rejected')
        root = ET.fromstring(text)
        rows = []
        for entry in root.iter():
            if entry.tag.rsplit('}', 1)[-1].lower() not in ('item', 'entry'):
                continue
            title = None
            link = None
            description = None
            pub_date = None
            for child in entry:
                key = child.tag.rsplit('}', 1)[-1].lower()
                if key == 'title':
                    title = ''.join(child.itertext()).strip()
                if key == 'link':
                    link = child.attrib.get('href') or (child.text or '').strip()
                if key in ('description', 'summary', 'content') and not description:
                    description = ''.join(child.itertext()).strip()
                if key in ('pubdate', 'published', 'updated') and not pub_date:
                    pub_date = ''.join(child.itertext()).strip()
            # Mastodon RSS posts can omit <title> while placing the complete
            # post in an HTML <description>. Preserve a readable candidate
            # label so the linked status can be fetched and extracted normally.
            if not title and description:
                description_soup = BeautifulSoup(description, 'html.parser')
                description_text = description_soup.get_text(' ', strip=True)
                first_paragraph = description_soup.find('p')
                title = (first_paragraph.get_text(' ', strip=True) if first_paragraph else '')
                title = re.sub(r'^[\s*#]+|[\s*#]+$', '', title).strip()
                if not title:
                    title = description_text.split('. ', 1)[0].strip()
                title = title[:180].rstrip() + ('…' if len(title) > 180 else '')
            if title and link:
                target = urljoin(final_url, link)
                if urlsplit(target).hostname in hosts:
                    row = {'url': target, 'title': title}
                    if description:
                        row['feed_text'] = BeautifulSoup(description, 'html.parser').get_text('\n', strip=True)
                    if pub_date:
                        try:
                            parsed_date = email.utils.parsedate_to_datetime(pub_date)
                            row['date_observations'] = [{
                                'meaning': 'listing_published_rfc822',
                                'locator': 'rss item pubDate',
                                'value': parsed_date.date().isoformat(),
                                'raw': pub_date,
                            }]
                        except (TypeError, ValueError, OverflowError):
                            row['date_observations'] = [{
                                'meaning': 'listing_published_unparsed',
                                'locator': 'rss item pubDate',
                                'value': pub_date,
                            }]
                    rows.append(row)
        return rows
    if content_type in ('application/json', 'text/plain') and body.lstrip().startswith((b'{', b'[')):
        data = json.loads(body)
        rows = []
        def walk(value):
            if isinstance(value, dict):
                link = next((value[k] for k in ('url', 'link', 'href', 'canonicalUrl', 'articleUrl') if isinstance(value.get(k), str)), None)
                title = next((value[k] for k in ('title', 'headline', 'name') if isinstance(value.get(k), str)), None)
                if link and title:
                    target = urljoin(final_url, link)
                    if urlsplit(target).hostname in hosts:
                        rows.append({'url': target, 'title': title})
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)
        walk(data)
        return list({row['url']: row for row in rows}.values())
    if content_type not in ('text/html', 'application/xhtml+xml'):
        raise ValueError('unsupported_listing_content_type:' + (content_type or 'missing'))
    soup = BeautifulSoup(body, 'html.parser')
    anchors = soup.select('article a[href]') or soup.select('main a[href], #content a[href], .content a[href]') or soup.select('a[href]')
    rows = []
    base = urlsplit(final_url)
    for anchor in anchors:
        title = _anchor_title(anchor)
        if len(title) < 10:
            continue
        target = urljoin(final_url, anchor['href'])
        parsed = urlsplit(target)
        path = parsed.path.lower()
        if (parsed.scheme != 'https' or parsed.hostname not in hosts or
            (parsed.hostname == base.hostname and parsed.path.rstrip('/') == base.path.rstrip('/')) or
            parsed.path.lower().endswith(('.pdf', '.jpg', '.jpeg', '.png', '.svg', '.css', '.js')) or
            any(word in path for word in ('/cdn-cgi/', '/email-protection', '/wp-content/', '/wp-includes/')) or
            any(word in (path + ' ' + title).lower() for word in ('newsletter', 'subscribe', 'sign up', 'privacy policy', 'cookie policy', 'login'))):
            continue
        rows.append({'url': target, 'title': title})
    return list({row['url']: row for row in rows}.values())


def extract_main_text(html, url):
    """Try Trafilatura first; caller decides whether source selectors are needed."""
    body = extract(html, url=url, output_format='txt', include_comments=False,
                   include_tables=True, include_formatting=True,
                   favor_precision=True)
    if not body:
        return None, None
    body = '\n'.join(line.strip() for line in body.splitlines() if line.strip())
    metadata = extract_metadata(html, default_url=url)
    return body, metadata


def ec_api_article_markup(payload, article_url):
    """Validate the EC Press Corner JSON envelope and expose its official markup."""
    try:
        data = json.loads(payload)
    except (TypeError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError('ec_detail_json_invalid') from error
    resource = data.get('docuLanguageResource') if isinstance(data, dict) else None
    path_match = re.fullmatch(r'/commission/presscorner/detail/en/([^/]+)/?', urlsplit(article_url).path)
    expected = path_match.group(1).replace('_', '/').upper() if path_match else None
    if (not isinstance(data, dict) or not expected or str(data.get('refCd', '')).upper() != expected or
            not isinstance(resource, dict) or not isinstance(resource.get('title'), str) or
            not isinstance(resource.get('htmlContent'), str) or data.get('originalLanguage') is None):
        raise ValueError('ec_detail_schema_or_identity_changed')

    soup = BeautifulSoup('<main><h1></h1><article></article></main>', 'html.parser')
    soup.h1.string = resource['title']
    soup.article.append(BeautifulSoup(resource['htmlContent'], 'html.parser'))
    for quote in resource.get('dolaQuoteResources', []):
        if (not isinstance(quote, dict) or not isinstance(quote.get('extract'), str) or
                not isinstance(quote.get('author'), dict) or
                not isinstance(quote['author'].get('authorName'), str)):
            raise ValueError('ec_quote_schema_changed')
        block = soup.new_tag('blockquote')
        text = soup.new_tag('p'); text.string = quote['extract']
        author = soup.new_tag('cite'); author.string = quote['author']['authorName']
        block.append(text); block.append(author); soup.article.append(block)

    observations = []
    raw_date = data.get('publishDate')
    if isinstance(raw_date, str):
        observations.append({'meaning': 'official_published_attribute',
                             'locator': 'EC documents.publishDate', 'value': raw_date})
    from scripts.collector.expansion import date as parse_source_date
    return {'markup': str(soup), 'title': resource['title'],
            'published_date': parse_source_date(raw_date) if raw_date else None,
            'date_observations': observations}


def detail_title(html, metadata, listing_title):
    """Prefer the actual page heading over a listing card's teaser text."""
    soup = BeautifulSoup(html, 'html.parser')
    generic_titles = {
        'main navigation', 'navigation', 'menu', 'news', 'press releases',
        'news release', 'home', 'search', 'untitled',
    }

    def useful(value):
        value = ' '.join((value or '').split())
        normalized = value.casefold().strip(' .:')
        if ('@edps@social.edps.europa.eu' in normalized or
                normalized.startswith('edps (@edps@')):
            return ''
        return value if len(value) >= 6 and normalized not in generic_titles else ''

    # Some sites put an accessibility/navigation heading before the article
    # H1. Inspect all headings and prefer the first meaningful article label.
    heading_text = next(
        (
            candidate
            for heading in soup.select('main h1, article h1, h1')
            if (candidate := useful(heading.get_text(' ', strip=True)))
        ),
        '',
    )
    metadata_title = ' '.join((getattr(metadata, 'title', None) or '').split()) if metadata else ''
    if ' | ' in metadata_title:
        metadata_title = metadata_title.split(' | ', 1)[0].strip()
    if ' • ' in metadata_title:
        metadata_title = metadata_title.split(' • ', 1)[0].strip()
    return heading_text or useful(metadata_title) or useful(listing_title) or ''


def privacy_signals(title, body):
    haystack = (title + '\n' + body).casefold()
    return [term for term in PRIVACY_SIGNAL_TERMS if term.casefold() in haystack]


def host_wide_access_failure(reason):
    """True only for transport responses that make same-host retries wasteful."""
    return bool(re.fullmatch(r'http_(?:401|403|429|5\d\d)', str(reason)))


def probe(source, configured=None):
    client = CrawleeClient(source['hosts'])
    record = {'source': source['id'], 'name': source['name'], 'cohort': source['cohort'],
              'cadence': source['cadence'], 'database_writes': False,
              'coverage_complete': False, 'status': 'failed', 'listing_url': source['listing']}
    try:
        listing_url = source['listing']
        if source['id'] == 'vn-gov':
            # Start from the documented policy index; the homepage spotlight
            # is the explicit fallback when its candidates are not relevant.
            listing_url = 'https://en.baochinhphu.vn/policies.htm'
        if source['id'] == 'ico' and source['id'] not in expansion.ROUTES:
            end = date.today(); start = end - timedelta(days=7)
            listing_url = parsers.ico_range_url(listing_url, start.isoformat(), end.isoformat())
        runtime_config = None
        if configured and source['id'] in SOURCE_ADAPTERS and source['id'] in {row['source'] for row in configured['sources']}:
            runtime_config = next(row for row in configured['sources'] if row['source'] == source['id'])
            config = {**runtime_config, 'listing': listing_url, 'hosts': source['hosts']}
            if source['id'] in expansion.ROUTES and source['id'] != 'ec':
                listing_url = expansion.listing_request_url(
                    source['id'], source['listing'],
                    (date.today() - timedelta(days=max(1, source.get('lookback_days', 3)) - 1)).isoformat(),
                    date.today().isoformat())
            if source['id'] == 'vn-gov':
                listing_url = 'https://en.baochinhphu.vn/policies.htm'
            if source['id'] == 'hk-pcpd':
                lookback_days = max(1, int(runtime_config.get('lookback_days', 3)))
                until = date.today()
                since = until - timedelta(days=lookback_days - 1)
                archive_dates = []
                archive_results = []
                archive_failures = []
                rows_by_url = {}
                day = until
                while day >= since:
                    archive_url = expansion.listing_request_url(
                        'hk-pcpd', source['listing'], since.isoformat(), day.isoformat())
                    archive_dates.append(day.isoformat())
                    try:
                        day_rows, _ = fetch_listing(source['id'], client, archive_url)
                        archive_results.append({'date': day.isoformat(), 'url': archive_url,
                                                'status': 'parsed', 'http_status': client.last_http_status,
                                                'candidate_count': len(day_rows)})
                        for row in day_rows:
                            rows_by_url.setdefault(row['url'], row)
                    except (FetchError, ValueError) as error:
                        failure = {'date': day.isoformat(), 'url': archive_url,
                                   'status': 'failed', 'http_status': client.last_http_status,
                                   'reason': str(error)[:180]}
                        archive_results.append(failure)
                        archive_failures.append(failure)
                    day -= timedelta(days=1)
                rows = list(rows_by_url.values())
                next_url = None
                record['listing'] = {
                    'status': 'parsed', 'route': 'official_daily_date_archives',
                    'window_start': since.isoformat(), 'window_end': until.isoformat(),
                    'archive_dates_visited': archive_dates,
                    'archive_results': archive_results,
                    'archive_failures': archive_failures,
                    'http_status': client.last_http_status,
                    'final_url': client.last_url if hasattr(client, 'last_url') else None,
                    'candidate_count': len(rows), 'next_url': next_url,
                }
            else:
                rows, next_url = fetch_listing(source['id'], client, listing_url)
                record['listing'] = {'status': 'parsed', 'http_status': client.last_http_status,
                                     'final_url': client.last_url if hasattr(client, 'last_url') else None,
                                     'candidate_count': len(rows), 'next_url': next_url}
        else:
            body, final, content_type = client.get(listing_url)
            rows = parse_listing(body, final, content_type, set(source['hosts']))
            record['listing'] = {'status': 'parsed', 'http_status': client.last_http_status,
                                 'final_url': final, 'content_type': content_type,
                                 'bytes': len(body)}
        discovered_count = len(rows)
        rejection_counts = {}
        rows = filter_listing_rows(rows, source, rejection_counts)
        if source['id'] == 'vn-gov' and not rows:
            primary_attempt = {
                'route': listing_url,
                'reason': 'no_privacy_relevant_candidate_from_policy_listing',
                'http_status': record['listing'].get('http_status'),
                'final_url': record['listing'].get('final_url'),
                'next_url': record['listing'].get('next_url'),
                'candidate_count': discovered_count,
                'relevant_candidate_count': 0,
                'rejection_counts': rejection_counts,
            }
            homepage = 'https://en.baochinhphu.vn/'
            fallback_attempt = {'route': homepage,
                                'reason': 'official_homepage_focus_fallback_after_empty_policy_match'}
            try:
                homepage_body, homepage_final, homepage_type = client.get(homepage)
                if homepage_type not in ('text/html', 'application/xhtml+xml'):
                    raise ValueError('vn_homepage_fallback_content_type_unsupported:' + (homepage_type or 'missing'))
                homepage_rows, _ = expansion.discover(
                    'vn-gov', homepage_body.decode('utf-8', 'replace'), homepage_final)
                fallback_attempt.update(http_status=client.last_http_status,
                                        final_url=homepage_final,
                                        candidate_count=len(homepage_rows))
                fallback_rejections = {}
                rows = filter_listing_rows(homepage_rows, source, fallback_rejections)
                fallback_attempt.update(relevant_candidate_count=len(rows),
                                        rejection_counts=fallback_rejections)
                discovered_count += len(homepage_rows)
                for reason, count in fallback_rejections.items():
                    rejection_counts[reason] = rejection_counts.get(reason, 0) + count
            except (FetchError, ValueError) as error:
                rows = []
                fallback_attempt.update(status='failed', error=str(error)[:180])
            record['listing'] = {
                'status': 'parsed' if rows else 'failed',
                'selected_route': homepage if rows else None,
                'fallback_reason': 'policy_listing_had_no_privacy_relevant_candidates',
                'attempts': [primary_attempt, fallback_attempt],
            }
        record['listing'].update(candidate_count=discovered_count,
                                 relevant_candidate_count=len(rows), candidates=rows)
        if rejection_counts:
            record['listing']['rejection_counts'] = rejection_counts
        if not rows:
            raise ValueError('listing_fetched_but_no_relevant_article_candidates')
        failures = []
        denied_hosts = {}
        detail_rows = rows[:1] if source['id'] == 'hk-pcpd' else rows
        for row in detail_rows:
            candidate_host = urlsplit(row.get('url', '')).hostname
            # A failed candidate must not leak the previous candidate's date
            # state or raise UnboundLocalError when this route has no date
            # adapter. Publication dates are assigned only from evidence
            # explicitly observed for the current candidate.
            published = None
            read_scope = 'trafilatura_main_text'
            body_extractor = 'trafilatura'
            if candidate_host in denied_hosts:
                failures.append({'url': row.get('url'),
                                 'reason': 'not_retried_after_same_host_' + denied_hosts[candidate_host]})
                continue
            try:
                feed_body = row.get('feed_text') if source['id'] == 'edps' else None
                verified_pdf_item = None
                article_for_text = None
                ec_detail = None
                if source['id'] == 'npc-ph' and row.get('rss_source') == 'npc-ph':
                    # NPC's official feed embeds the complete article in
                    # content:encoded; the linked HTML page returns 403 and
                    # is intentionally not requested.
                    from scripts.collector.extraction import extract_official_rss_post
                    item = extract_official_rss_post(row)
                    extracted = item['content_text']
                    metadata = None
                    final = row['url']
                    content_type = 'application/rss+xml'
                    article = b''
                    read_scope = item['metadata']['read_scope']
                    body_extractor = item['metadata']['extraction_method']
                    published = item.get('published_date')
                    feed_body = extracted
                elif source['id'] == 'nl-ap' and row.get('rss_source') == 'nl-ap':
                    # The official RSS is a discovery index. Fetch the linked
                    # article through the shared robots-aware Crawlee client;
                    # Protego applies the longer Allow rule for /actueel/*.
                    detail_url = expansion.detail_request_url('nl-ap', row['url'])
                    article, final, content_type = client.get(detail_url)
                    expansion.verify_detail_response('nl-ap', row['url'], final)
                    from scripts.collector.extraction import extract_document
                    item = extract_document('nl-ap', article, final, content_type, row)
                    item['published_date'] = parsers.ftc_listing_date(row)
                    item['metadata']['date_observations'] = list(row.get('date_observations', []))
                    item['metadata']['source_body_completeness'] = 'full_article_body'
                    item['metadata']['factual_status'] = 'official_article_machine_extracted_not_human_reviewed'
                    item['metadata']['requires_review'] = True
                    extracted = item['content_text']
                    metadata = None
                    read_scope = item['metadata']['read_scope']
                    body_extractor = item['metadata']['extraction_method']
                    published = item.get('published_date')
                    feed_body = None
                elif source['id'] == 'eu-council' and row.get('rss_source') == 'eu-council':
                    # The Council route is intentionally summary-only; never
                    # request linked detail pages on this source route.
                    from scripts.collector.extraction import extract_official_rss_summary
                    item = extract_official_rss_summary(row)
                    extracted = item['content_text']
                    metadata = None
                    final = row['url']
                    content_type = 'application/rss+xml'
                    article = b''
                    read_scope = item['metadata']['read_scope']
                    body_extractor = item['metadata']['extraction_method']
                    published = item.get('published_date')
                    feed_body = extracted
                elif feed_body:
                    article, final, content_type = b'', row['url'], 'application/rss+xml'
                    extracted, metadata = feed_body, None
                else:
                    detail_url = expansion.detail_request_url(source['id'], row['url']) if source['id'] in expansion.ROUTES else row['url']
                    article, final, content_type = client.get(detail_url)
                    if source['id'] in expansion.ROUTES:
                        expansion.verify_detail_response(source['id'], row['url'], final)
                    article_for_text = article
                    if source['id'] == 'ec' and content_type == 'application/json':
                        ec_detail = ec_api_article_markup(article, row['url'])
                        article_for_text = ec_detail['markup'].encode('utf-8')
                        # Unwrap and identity-check the official API envelope
                        # before passing its article markup to Trafilatura.
                        extracted, metadata = extract_main_text(article_for_text, row['url'])
                        published = ec_detail['published_date']
                    else:
                        extracted, metadata = extract_main_text(article, final) if content_type in ('text/html', 'application/xhtml+xml') else (None, None)
                    from scripts.collector.pdf_source_routes import supports_pdf_source_page
                    if source['id'] in ('jpdp-my', 'global-cbpr', 'ppc', 'cn-tc260') and supports_pdf_source_page(source['id'], final):
                        from scripts.collector.extraction import extract_verified_pdf_attachments
                        verified_pdf_item = extract_verified_pdf_attachments(
                            source['id'], article, final, content_type, row, client)
                        extracted = verified_pdf_item['content_text']
                        metadata = None
                        published = verified_pdf_item.get('published_date')
                        read_scope = verified_pdf_item['metadata']['read_scope']
                        body_extractor = verified_pdf_item['metadata']['extraction_method']
                trafilatura_characters = len(extracted or '')
                if verified_pdf_item is not None:
                    trafilatura_characters = verified_pdf_item['metadata'].get('trafilatura_first_attempt_characters', 0)
                title_markup = article_for_text if article_for_text is not None else article
                extracted_title = (detail_title(title_markup, metadata, row.get('title'))
                                   if content_type in ('text/html', 'application/xhtml+xml') or ec_detail else row.get('title'))
                if source['id'] not in ('npc-ph', 'nl-ap', 'eu-council', 'jpdp-my','global-cbpr','ppc','ec','cn-tc260'):
                    published = next((observation['value'] for observation in row.get('date_observations', [])
                                      if observation.get('meaning') == 'listing_published_rfc822' and
                                      re.fullmatch(r'\d{4}-\d{2}-\d{2}', observation.get('value', ''))), None)
                if source['id'] not in ('npc-ph', 'nl-ap', 'eu-council', 'jpdp-my','global-cbpr','ppc','cn-tc260'):
                    read_scope = 'official_rss_item_full_post' if feed_body else 'trafilatura_main_text'
                    body_extractor = 'official_mastodon_rss_description' if feed_body else 'trafilatura'
                adapter_body = None
                configured_ids = {item['source'] for item in configured['sources']} if configured else set()
                has_adapter = (source['id'] in SOURCE_ADAPTERS and source['id'] in configured_ids
                               and source['id'] not in ('npc-ph', 'nl-ap','jpdp-my','global-cbpr'))
                # Trafilatura is always attempted first. Existing adapters run
                # only after that attempt, supplying metadata/date evidence and
                # body text only if Trafilatura produced no text.
                if has_adapter:
                    ec_adapter_needed = source['id'] == 'ec' and content_type == 'application/json' and not (extracted or '').strip()
                    if source['id'] != 'ec' or ec_adapter_needed:
                        try:
                            parser_url = row['url'] if source['id'] in ('anpd-br', 'ec') else final
                            if source['id'] == 'ec' and content_type == 'application/json':
                                # The EC source parser is a body fallback only;
                                # the verified API envelope already supplies
                                # official title/date evidence above.
                                item = expansion.extract('ec', article.decode('utf-8', 'replace'), parser_url, row)
                            else:
                                item = parsers.extract_document(source['id'], article, parser_url, content_type, row)
                            adapter_body = item.get('content_text', '').strip()
                            published = item.get('published_date')
                            from scripts.collector.extraction import SOURCE_ADAPTER_MIN_BODY_CHARS
                            minimum = SOURCE_ADAPTER_MIN_BODY_CHARS.get(source['id'], 0)
                            if (not extracted or not extracted.strip() or
                                    (minimum and len(extracted.strip()) < minimum and
                                     len(adapter_body) > len(extracted.strip()))):
                                extracted = adapter_body or None
                                read_scope = item.get('metadata', {}).get('read_scope', 'source_adapter_fallback')
                                body_extractor = ('pypdf' if source['id'] == 'iso-iec-sc27' else
                                                  'source_parser_short_body_fallback' if minimum else
                                                  'source_specific_adapter_fallback')
                            if source['id'] == 'iso-iec-sc27':
                                verified_pdf_item = item
                                read_scope = item.get('metadata', {}).get('read_scope', 'official_source_pdf_text')
                                body_extractor = 'pypdf'
                        except Exception as error:
                            record.setdefault('adapter_errors', []).append({
                                'source': source['id'], 'error': type(error).__name__})
                if not extracted or not extracted.strip():
                    raise ValueError('detail_fetched_but_main_text_not_extracted:' + content_type)
                record['sample'] = {'url': row['url'], 'title': extracted_title, 'listing_title': row.get('title'), 'final_url': final,
                                    'content_type': content_type, 'body_characters': len(extracted),
                                    'body_sha256': hashlib.sha256(extracted.encode()).hexdigest(),
                                    'publication_date_candidate': published or (metadata.date if metadata else None),
                                    'date_evidence_source': ('official RSS item pubDate, normalized to Asia/Seoul' if feed_body and published else
                                                             'source-specific official listing date' if source['id'] in ('jpdp-my','global-cbpr') and published else
                                                             'official EC API publishDate' if source['id']=='ec' and published else
                                                             'official listing month only; no full publication date' if source['id']=='iso-iec-sc27' else
                                                             'source_adapter' if published else
                                                             'Trafilatura candidate; adapter verification required'),
                                    'read_scope': read_scope, 'body_extractor': body_extractor,
                                    'trafilatura_characters': trafilatura_characters,
                                    'adapter_fallback_available': bool(adapter_body),
                                    'privacy_signal_terms': privacy_signals(extracted_title or '', extracted),
                                    'privacy_relevance': 'signals_found_unreviewed' if privacy_signals(extracted_title or '', extracted) else 'no_known_signal_unreviewed',
                                    'body_length_note': 'short_notice_review' if len(extracted.strip()) < 500 else 'length_not_a_quality_verdict'}
                if source['id'] in ('npc-ph', 'nl-ap'):
                    record['sample']['body_scope'] = 'full_article_from_official_rss_content_encoded' if source['id'] == 'npc-ph' else 'official_rss_discovery_plus_robots_allowed_detail'
                    record['sample']['requires_human_review'] = True
                    record['sample']['ai_ready'] = False
                    record['detail_request_made'] = source['id'] == 'nl-ap'
                if source['id'] in ('jpdp-my','global-cbpr','iso-iec-sc27'):
                    record['sample']['body_scope'] = 'official_linked_pdf_text'
                    record['sample']['requires_human_review'] = True
                    record['sample']['ai_ready'] = False
                    record['sample']['date_observations'] = row.get('date_observations', [])
                    record['sample']['pdf_page_count'] = len((verified_pdf_item or {}).get('metadata',{}).get('pdf_pages',[]))
                    record['sample']['pdf_document_urls'] = [item['url'] for item in (verified_pdf_item or {}).get('metadata',{}).get('related_documents',[]) if item.get('read')]
                if source['id'] == 'ec' and ec_detail:
                    record['sample']['official_title'] = ec_detail['title']
                    record['sample']['date_observations'] = ec_detail['date_observations']
                record['status'] = 'listing_and_body_extracted'
                record['qualification'] = {
                    'privacy_relevance': 'unreviewed',
                    'publication_date': 'candidate_only',
                    'pagination_complete': False,
                    'scheduled_collection_ready': False,
                }
                if source['id'] == 'nl-ap':
                    record['qualification']['body_scope'] = 'official_detail_article'
                    record['qualification']['full_article_available'] = True
                    record['qualification']['detail_fetch_status'] = 'fetched_robots_allowed_protego_0_6_2'
                elif source['id'] == 'npc-ph':
                    record['qualification']['body_scope'] = 'full_article_from_official_rss'
                    record['qualification']['full_article_available'] = True
                    record['qualification']['detail_fetch_status'] = 'not_requested_rss_body_used'
                break
            except Exception as error:
                reason = str(error)[:180]
                failures.append({
                    'url': row.get('url'),
                    'reason': reason,
                    'http_status': client.last_http_status,
                    'final_url': client.last_url,
                })
                if candidate_host and host_wide_access_failure(reason):
                    denied_hosts[candidate_host] = reason
        if record['status'] != 'listing_and_body_extracted':
            record['detail_failures'] = failures
            raise ValueError('no_detail_candidate_parsed')
    except Exception as error:
        record['error'] = str(error)[:500]
        if 'listing' not in record:
            record['stage'] = 'listing_fetch'
        elif 'sample' not in record:
            record['stage'] = 'listing_or_detail_parse'
    record['requests'] = client.requests
    record['downloaded_bytes'] = client.downloaded_bytes
    client.close()
    return record


def select_probe_sources(sources, requested=None):
    """Never probe an inventory entry explicitly held out by the user."""
    requested=set(requested or [])
    by_id={row['id']:row for row in sources}
    unknown=requested-set(by_id)
    if unknown:raise ValueError('unknown_source_ids:'+','.join(sorted(unknown)))
    held={source_id for source_id,row in by_id.items()
          if row.get('explicit_user_hold') is True
          or row.get('verification_status')=='held_by_user'
          or row.get('cohort')=='previously-tested-held'
          or str(row.get('hold_reason','')).startswith('user_deferred_')}
    explicit_hold=requested & held
    if explicit_hold:raise ValueError('source_held_by_user:'+','.join(sorted(explicit_hold)))
    eligible=[row for row in sources if row['id'] not in held]
    return [row for row in eligible if not requested or row['id'] in requested]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', action='append', help='Repeat to select source IDs; defaults to the full catalog')
    parser.add_argument('--output', default='work/source-catalog-probe.json')
    args = parser.parse_args()
    catalog = load_catalog()
    try:
        sources=select_probe_sources(catalog['sources'],args.source)
    except ValueError as error:
        parser.error(str(error))
    configured_path = Path(__file__).resolve().parents[1] / 'config' / 'trend-collector.json'
    configured = json.loads(configured_path.read_text(encoding='utf-8')) if configured_path.exists() else None
    results = [probe(item, configured) for item in sources]
    summary = {'started_at': datetime.now(timezone.utc).isoformat(), 'scope_count': len(sources),
               'sources': results, 'database_writes': False, 'coverage_complete': False}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    for item in results:
        print(json.dumps({k: item[k] for k in ('source', 'status', 'stage', 'error') if k in item}, ensure_ascii=False))
    CRAWLEE_LOOP.close()
    if not results or any(item['status'] != 'listing_and_body_extracted' for item in results):
        raise SystemExit(3)


if __name__ == '__main__':
    main()
