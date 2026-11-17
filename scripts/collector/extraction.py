"""Trafilatura-first body extraction shared by every production collector path."""
import datetime as dt
import hashlib
import json

from bs4 import BeautifulSoup

from . import parsers


# These adapters contain institution-specific selectors for pages where the
# generic main-text extractor can return only a navigation fragment. Keep the
# threshold limited to sources whose observed short samples prompted a review.
SOURCE_ADAPTER_MIN_BODY_CHARS = {
    'pdpc': 500,
    'ppc': 500,
    'cn-tc260': 500,
    # overview.legal hydrates its long decision text outside the first
    # extraction candidate. A short navigation-only result must fall back to
    # the page's dedicated .rd-text document body instead of being stored.
    'overview-legal': 500,
}


def _article_title(data, metadata, source_item, row):
    """Prefer a document's own heading over a teaser title from its listing."""
    try:
        soup = BeautifulSoup(data, 'html.parser')
        headings = [parsers.normalize(node.get_text(' ', strip=True))
                    for node in soup.select('main h1, article h1, h1')]
    except Exception:
        headings = []
    generic = {'news', 'press releases', 'news release', 'home', 'search', 'untitled'}
    for value in headings:
        if value and value.casefold().strip(' .:') not in generic:
            return value
    value = parsers.normalize(getattr(metadata, 'title', '') or '')
    for separator in (' | ', ' • '):
        if separator in value:
            value = value.split(separator, 1)[0].strip()
    if value and value.casefold().strip(' .:') not in generic:
        return value
    value = parsers.normalize((source_item or {}).get('title_original', ''))
    return value or parsers.normalize((row or {}).get('title', ''))


def _trafilatura_item(source, data, url, content_type, row=None):
    if content_type not in ('text/html', 'application/xhtml+xml'):
        return None
    try:
        import trafilatura
        text = trafilatura.extract(
            data,
            url=url,
            output_format='txt',
            include_comments=False,
            include_tables=True,
            include_formatting=True,
            favor_precision=True,
        )
    except Exception:
        return None
    if not isinstance(text, str):
        return None
    body = parsers.normalize(text)
    if not body.strip():
        return None
    try:
        trafilatura_metadata = trafilatura.extract_metadata(data, default_url=url)
    except Exception:
        trafilatura_metadata = None
    title = _article_title(data, trafilatura_metadata, None, row)
    if not title:
        return None
    item = {
        'title_original': title,
        'content_text': body,
        'content_hash': hashlib.sha256(body.encode()).hexdigest(),
        'published_date': None,
        'metadata': {
            'normalization_version': parsers.NORMALIZATION_VERSION,
            'parser_version': 'trafilatura-first-v1',
            'read_scope': 'trafilatura_main_text_unverified',
            'date_observations': [],
            'trafilatura_date_candidate': getattr(trafilatura_metadata, 'date', None) if trafilatura_metadata else None,
            'requires_review': True,
            'related_documents': [],
            'unread_attachments': [],
            'factual_status': 'official_page_text_not_independently_reviewed',
            'ai_ready': False,
            'extraction_method': 'trafilatura',
        },
    }
    # The Trafilatura body remains authoritative. Once it has succeeded, reuse
    # the established adapter only for verified source metadata/date evidence.
    source_metadata_error = None
    try:
        source_item = parsers.extract_document(source, data, url, content_type, row)
    except Exception as error:
        source_item = None
        source_metadata_error = type(error).__name__
    if source_item is not None:
        item['published_date'] = source_item.get('published_date')
        preserved = source_item.get('metadata') or {}
        item['metadata'].update(preserved)
        item['metadata'].update(
            parser_version='trafilatura-first-v1',
            read_scope='trafilatura_main_text',
            extraction_method='trafilatura',
            source_metadata_parser='existing_source_adapter',
            # Keep date/consistency review semantics from the source adapter,
            # while explicitly recording that a person has not reviewed the
            # extracted wording. Draft eligibility is not publication approval.
            requires_review=bool(preserved.get('requires_review', True)),
            ai_ready=False,
            body_review_status='machine_extracted_not_human_reviewed',
        )
        item['title_original'] = _article_title(data, trafilatura_metadata, source_item, row)
        if not item['title_original']:
            return None
    elif source_metadata_error:
        item['metadata']['source_metadata_error'] = source_metadata_error
    return item


def extract_document(source, data, url, content_type, row=None):
    """Use Trafilatura for body text first, then adapter for metadata; fall back on body failure."""
    if source=='imda':
        return extract_imda_release(data,url,row)
    item = _trafilatura_item(source, data, url, content_type, row)
    minimum = SOURCE_ADAPTER_MIN_BODY_CHARS.get(source)
    if item is not None and minimum and len(item['content_text']) < minimum:
        try:
            adapter_item = parsers.extract_document(source, data, url, content_type, row)
        except Exception:
            adapter_item = None
        adapter_body = parsers.normalize((adapter_item or {}).get('content_text', ''))
        if len(adapter_body) > len(item['content_text']):
            adapter_item['content_text'] = adapter_body
            adapter_item['content_hash'] = hashlib.sha256(adapter_body.encode()).hexdigest()
            adapter_item['metadata']['extraction_method'] = 'source_parser_short_body_fallback'
            adapter_item['metadata']['trafilatura_first_attempt'] = 'below_source_minimum'
            adapter_item['metadata']['trafilatura_first_attempt_characters'] = len(item['content_text'])
            adapter_item['metadata']['source_parser_characters'] = len(adapter_body)
            adapter_item['metadata']['requires_review'] = True
            adapter_item['metadata']['ai_ready'] = False
            adapter_item['metadata']['body_review_status'] = 'machine_extracted_not_human_reviewed'
            return adapter_item
        item['metadata']['source_parser_short_body_fallback'] = (
            'no_longer_body_available' if adapter_item is not None else 'source_parser_failed')
        item['metadata']['minimum_body_characters'] = minimum
    if item is not None:
        return item
    item = parsers.extract_document(source, data, url, content_type, row)
    item['metadata']['extraction_method'] = 'source_parser_fallback'
    item['metadata']['trafilatura_first_attempt'] = 'no_usable_main_text'
    return item


def extract_imda_release(data,url,row=None):
    """Prefer full official IMDA article text; preserve short official teasers as review-only."""
    from . import parsers
    raw=data.decode('utf-8','replace') if isinstance(data,(bytes,bytearray)) else str(data)
    soup=BeautifulSoup(raw,'html.parser')
    title=parsers.normalize((row or {}).get('title',''))
    if not title:
        node=soup.select_one('main h1,article h1,h1')
        title=parsers.normalize(node.get_text(' ',strip=True) if node else '')
    if not title:raise ValueError('imda_article_title_missing')
    full_candidates=[]
    for script in soup.select('script[type="application/ld+json"]'):
        try:payload=json.loads(script.get_text(strip=True))
        except (TypeError,json.JSONDecodeError):continue
        candidates=payload if isinstance(payload,list) else [payload]
        for candidate in candidates:
            if not isinstance(candidate,dict):continue
            graph=candidate.get('@graph')
            if isinstance(graph,list):candidates.extend(graph)
            body=candidate.get('articleBody')
            if isinstance(body,str):full_candidates.append(body)
    for selector in ('article.detail-content','main article.detail-content','.detail-content'):
        node=soup.select_one(selector)
        if node:
            for part in node.select('script,style,nav,footer,template,button,[hidden]'):part.decompose()
            value=parsers.normalize(node.get_text('\n',strip=True))
            if value:full_candidates.append(value)
            break
    full=next((parsers.normalize(value) for value in full_candidates
               if len(parsers.normalize(value))>=100 and not re.search(r'\{\{|\$\{|\bloading\b',value,re.I)),None)
    description=''
    for selector,attribute in (('meta[name="description"]','content'),('meta[property="og:description"]','content')):
        node=soup.select_one(selector)
        if node and node.get(attribute):
            description=parsers.normalize(node.get(attribute));break
    published=(row or {}).get('published_date')
    if not isinstance(published,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',published):published=None
    observations=list((row or {}).get('date_observations') or [])
    body=full or description or parsers.normalize((row or {}).get('feed_text',''))
    if not body:raise ValueError('imda_article_and_official_teaser_empty')
    complete=full is not None
    body=parsers.normalize(body)
    return {'title_original':title,'content_text':body,'content_hash':hashlib.sha256(body.encode()).hexdigest(),
        'published_date':published,'metadata':{'normalization_version':parsers.NORMALIZATION_VERSION,
            'parser_version':'imda-release-body-v2' if complete else 'imda-official-teaser-v2',
            'read_scope':'official_article_body' if complete else 'official_article_metadata_or_listing_teaser_only',
            'source_body_completeness':'full_article_body' if complete else 'official_summary_only',
            'date_observations':observations,'requires_review':not complete,
            'related_documents':[],'unread_attachments':[],
            'factual_status':'official_imda_release_machine_extracted_not_human_reviewed',
            'relevance_reason':'official_imda_privacy_topic_human_review_pending',
            'ai_ready':bool(published and complete),
            'extraction_method':'imda_official_article_body' if complete else 'imda_official_teaser_fallback'}}


def extract_official_rss_post(row):
    """Build an item from an official RSS entry carrying its full article body."""
    body = parsers.normalize((row or {}).get('feed_text', ''))
    title = parsers.normalize((row or {}).get('title', ''))
    if not title or not body:
        raise ValueError('official_rss_post_missing_title_or_body')
    observations = (row or {}).get('date_observations', [])
    published = parsers.ftc_listing_date(row or {})
    source = (row or {}).get('rss_source')
    edps = source == 'edps'
    return {
        'title_original': title,
        'content_text': body,
        'content_hash': hashlib.sha256(body.encode()).hexdigest(),
        'published_date': published,
        'metadata': {
            'normalization_version': parsers.NORMALIZATION_VERSION,
            'parser_version': 'official-mastodon-rss-v1' if edps else 'official-npc-rss-content-encoded-v1',
            'read_scope': 'official_rss_item_full_post' if edps else 'official_rss_item_full_body',
            'date_observations': observations,
            'requires_review': True,
            'related_documents': [],
            'unread_attachments': [],
            'factual_status': 'official_social_post_not_independently_reviewed' if edps else 'official_npc_news_item_not_independently_reviewed',
            'ai_ready': False,
            'extraction_method': (row or {}).get('feed_body_source', 'official_rss_item_content'),
        },
    }


def extract_official_rss_summary(row):
    """Retain a source-published RSS summary without calling it full article text."""
    body = parsers.normalize((row or {}).get('feed_text', ''))
    title = parsers.normalize((row or {}).get('title', ''))
    if not title or not body:
        raise ValueError('official_rss_summary_missing_title_or_text')
    observations = (row or {}).get('date_observations', [])
    published = parsers.ftc_listing_date(row or {})
    if (row or {}).get('rss_source')=='eu-council' and observations:
        value=observations[0].get('value','')
        try:
            stamp=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
            if stamp.utcoffset() is not None:
                from zoneinfo import ZoneInfo
                published=stamp.astimezone(ZoneInfo('Asia/Seoul')).date().isoformat()
        except (TypeError,ValueError,OverflowError):
            published=None
    return {
        'title_original': title,
        'content_text': body,
        'content_hash': hashlib.sha256(body.encode()).hexdigest(),
        'published_date': published,
        'metadata': {
            'normalization_version': parsers.NORMALIZATION_VERSION,
            'parser_version': 'official-rss-summary-v1',
            'read_scope': 'official_rss_summary_only',
            'date_observations': observations,
            'requires_review': True,
            'related_documents': [{'url': (row or {}).get('url'), 'title': title, 'read': False}],
            'unread_attachments': [(row or {}).get('url')],
            'factual_status': 'official_council_rss_summary_only_full_article_not_fetched' if (row or {}).get('rss_source')=='eu-council' else 'official_feed_summary_only_full_article_not_fetched',
            'ai_ready': False,
            'extraction_method': 'official_rss_description_or_summary',
            'source_body_completeness': 'summary_only',
        },
    }


def extract_eu_parliament_linked_pdf(document_json, api_url, row, client):
    """Fetch and extract only a PDF manifestation linked by an EP Open Data record."""
    from urllib.parse import urlsplit,urljoin
    from . import parsers, expansion
    from .core import FetchError,canonical_url
    try:
        payload=json.loads(document_json.decode('utf-8') if isinstance(document_json,bytes) else document_json)
    except (UnicodeDecodeError,TypeError,json.JSONDecodeError):
        raise ValueError('eu_parliament_detail_json_invalid') from None
    entity=payload.get('data') if isinstance(payload,dict) else None
    if isinstance(entity,list):
        entity=entity[0] if len(entity)==1 else None
    if not isinstance(entity,dict):raise ValueError('eu_parliament_detail_schema_changed')
    ident=entity.get('id') or entity.get('identifier')
    expected=urlsplit(api_url).path.rsplit('/',1)[-1]
    if not isinstance(ident,str) or ident.rsplit('/',1)[-1]!=expected:
        raise ValueError('eu_parliament_detail_identity_mismatch')
    title=entity.get('title_dcterms') or entity.get('title') or entity.get('label')
    if isinstance(title,dict):title=title.get('en') or title.get('@value')
    title=parsers.normalize(title or '')
    if not title:raise ValueError('eu_parliament_detail_title_missing')
    # JSON-LD compacts is_exemplified_by as a relative IRI. Resolve it only
    # against the API's declared @base and keep the configured official hosts.
    context=payload.get('@context')
    contexts=context if isinstance(context,list) else [context]
    api_base=next((entry.get('@base') for entry in contexts
                   if isinstance(entry,dict) and isinstance(entry.get('@base'),str)),None)
    if api_base!='https://data.europarl.europa.eu/':
        raise ValueError('eu_parliament_jsonld_base_unverified')
    urls=[]
    def visit(value):
        if isinstance(value,str):
            candidate=urljoin(api_base,value)
            try:parsed=urlsplit(canonical_url(candidate,expansion.ROUTES['eu-parliament']['hosts']))
            except ValueError:return
            if parsed.path.lower().endswith('.pdf') and not parsed.query and not parsed.fragment:
                urls.append(parsed.geturl())
        elif isinstance(value,dict):
            for child in value.values():visit(child)
        elif isinstance(value,list):
            for child in value:visit(child)
    visit(entity.get('is_realized_by'))
    if not urls:raise ValueError('eu_parliament_pdf_manifestation_missing')
    pdf_url=sorted(set(urls),key=lambda value:('/EN/' not in urlsplit(value).path.upper(),len(value)))[0]
    try:data,final,content_type=client.get(pdf_url)
    except FetchError as error:
        if str(error) in ('http_403','http_404','http_410','network_policy_denied_403'):
            raise ValueError('eu_parliament_manifestation_unavailable') from None
        raise
    if urlsplit(final).hostname not in expansion.ROUTES['eu-parliament']['hosts'] or not data.startswith(b'%PDF-'):
        raise ValueError('eu_parliament_manifestation_not_pdf')
    pdf=parsers.extract_pdf(data,'eu-parliament')
    body=parsers.normalize('\n'.join(page['text'] for page in pdf['pages']))
    if len(body)<100:raise ValueError('eu_parliament_pdf_text_too_short')
    date_value=(entity.get('document_date') or entity.get('date_document') or
                entity.get('date') or entity.get('publication_date'))
    published=expansion.date(date_value) if isinstance(date_value,str) else None
    # Keep date-unknown full text for review; never infer a publication date.
    observations=list((row or {}).get('date_observations') or [])
    if isinstance(date_value,str):
        observations.append({'meaning':'official_published_attribute','locator':'European Parliament Open Data API document date','value':date_value})
    observations.append({'meaning':'official_manifestation_link','locator':'European Parliament Open Data API linked PDF manifestation','value':pdf_url})
    body=parsers.normalize(body)
    return {'title_original':title,'content_text':body,'content_hash':hashlib.sha256(body.encode()).hexdigest(),
        'published_date':published,'metadata':{'normalization_version':parsers.NORMALIZATION_VERSION,
            'parser_version':'ep-open-data-linked-pdf-v1','read_scope':'official_open_data_linked_pdf_text',
            'date_observations':observations,'pdf_pages':pdf['pages'],'pdf_ocr_pages':pdf['ocr_pages'],
            'requires_review':not bool(published),'related_documents':[{'url':pdf_url,'title':title,'read':True}],
            'unread_attachments':pdf['related_documents'],'factual_status':'official_european_parliament_document_not_independently_reviewed',
            'license':'CC BY 4.0','attribution_required':True,
            'attribution':'European Parliament Open Data',
            'relevance_reason':'official_open_data_full_text_human_topic_review_pending','ai_ready':bool(published),
            'extraction_method':pdf['extraction_method']}}


def extract_verified_pdf_attachments(source, html, page_url, content_type, row, client):
    """Read verified official PDF attachments after trying the HTML page first.

    Used only for evidence-backed document routes. Trafilatura gets
    the article page first; its output is retained as diagnostic evidence while
    the explicitly linked primary PDF is extracted with the shared pypdf path.
    """
    if source not in ('jpdp-my', 'global-cbpr', 'ppc', 'cn-tc260'):
        raise ValueError('pdf_attachment_source_not_supported')
    html_attempt = _trafilatura_item(source, html, page_url, content_type, row)
    ppc_date_item = None
    if source == 'ppc':
        # PDF-first evidence routes must still obtain publication metadata
        # from the official HTML notice page. The PDF itself may contain event,
        # enactment, or update dates that are not the notice publication date.
        from . import parsers
        try:
            ppc_date_item = parsers.extract_document(
                'ppc', html.encode('utf-8') if isinstance(html, str) else html,
                page_url, content_type, row)
        except (ValueError, UnicodeError):
            # Retain the explicit listing date as a fallback when an old notice
            # template cannot be parsed; never mine dates from the PDF text.
            ppc_date_item = None
    from .pdf_source_routes import discover_pdf_links
    links = discover_pdf_links(source, html, page_url, row)
    if not links:
        return _official_html_fallback(source, html_attempt, page_url, row, 'official_pdf_not_linked')
    # The helper only emits source-specific URLs observed on official pages.
    from . import parsers
    from urllib.parse import unquote, urlsplit
    pages = []
    documents = []
    body_parts = []
    for link in links:
        try:
            pdf_data, final_url, pdf_type = client.get(link['url'])
        except Exception:
            if html_attempt and html_attempt.get('content_text'):
                return _official_html_fallback(source, html_attempt, page_url, row, 'official_pdf_fetch_failed', links)
            raise
        expected = urlsplit(link['url'])
        actual = urlsplit(final_url)
        same_identity = (actual.scheme == expected.scheme == 'https' and
                         actual.hostname == expected.hostname and
                         unquote(actual.path) == unquote(expected.path) and
                         not actual.query and not actual.fragment)
        if not same_identity or pdf_type not in ('application/pdf', 'application/octet-stream'):
            if html_attempt and html_attempt.get('content_text'):
                return _official_html_fallback(source, html_attempt, page_url, row, 'official_pdf_response_mismatch', links)
            raise ValueError('verified_source_pdf_response_mismatch')
        pdf = parsers.extract_pdf(pdf_data, final_url, source)
        text = parsers.normalize(' '.join(page['text'] for page in pdf['pages']))
        if not text:
            if html_attempt and html_attempt.get('content_text'):
                return _official_html_fallback(source, html_attempt, page_url, row, 'official_pdf_text_empty', links)
            raise ValueError('verified_source_pdf_text_empty')
        body_parts.append(link['title'] + '\n' + text)
        pages.extend({'document_url': final_url, 'document_title': link['title'],
                      'extraction_method': pdf.get('extraction_method', 'pypdf'), **page}
                     for page in pdf['pages'])
        documents.append({'url': final_url, 'title': link['title'], 'read': True})
    body = parsers.normalize('\n\n'.join(body_parts))
    published = parsers.expansion.listing_date(row or {})
    date_observations = list((row or {}).get('date_observations', []))
    date_conflict = False
    if ppc_date_item is not None:
        date_observations = list(ppc_date_item.get('metadata', {}).get('date_observations', [])) + date_observations
        detail_published = ppc_date_item.get('published_date')
        if detail_published:
            if published and published != detail_published:
                date_conflict = True
                published = None
            else:
                published = detail_published
    return {
        'title_original': parsers.normalize((row or {}).get('title', '')),
        'content_text': body,
        'content_hash': hashlib.sha256(body.encode()).hexdigest(),
        'published_date': published,
        'metadata': {
            'normalization_version': parsers.NORMALIZATION_VERSION,
            'parser_version': 'verified-source-pdf-attachments-v1',
            'read_scope': 'official_source_pdf_attachment_text',
            'date_observations': date_observations,
            'date_conflict': date_conflict,
            'pdf_pages': pages,
            'trafilatura_first_attempt_characters': len((html_attempt or {}).get('content_text', '')),
            'requires_review': True,
            'related_documents': documents,
            'unread_attachments': [],
            'source_page_url': page_url,
            'factual_status': 'official_source_documents_machine_extracted_not_human_reviewed',
            'ai_ready': False,
            'extraction_method': ('trafilatura_attempt_then_ocrmypdf+pypdf'
                                  if any(page['extraction_method'] != 'pypdf' for page in pages)
                                  else 'trafilatura_attempt_then_pypdf'),
        },
    }


def _official_html_fallback(source, item, page_url, row, reason, links=None):
    """Retain useful official notice text when its optional PDF is unavailable."""
    if not item or not item.get('content_text'):
        raise ValueError('verified_source_pdf_attachment_missing' if reason == 'official_pdf_not_linked' else reason)
    from . import parsers
    body = parsers.normalize(item['content_text'])
    metadata = dict(item.get('metadata') or {})
    related = list(metadata.get('related_documents') or [])
    known = {document.get('url') for document in related if isinstance(document, dict)}
    for link in links or []:
        if link['url'] not in known:
            related.append({'url': link['url'], 'title': link.get('title', ''), 'read': False})
            known.add(link['url'])
    metadata.update({
        'parser_version': 'verified-source-html-fallback-v1',
        'read_scope': 'official_html_body_pdf_unavailable',
        'requires_review': True,
        'ai_ready': False,
        'source_page_url': page_url,
        'factual_status': 'official_html_body_machine_extracted_pdf_unavailable',
        'extraction_method': 'trafilatura_html_fallback',
        'pdf_fallback_reason': reason,
        'related_documents': related,
        'unread_attachments': [
            document['url'] for document in related
            if isinstance(document, dict) and document.get('url') and document.get('read') is not True
        ],
    })
    item['content_text'] = body
    item['content_hash'] = hashlib.sha256(body.encode()).hexdigest()
    item['published_date'] = parsers.expansion.listing_date(row or {})
    item['metadata'] = metadata
    return item
