"""Prepare one bounded Python collection step; the connector commits it atomically.

No credentials and no DB writes. An uncommitted bundle never advances DB state.
Use only with a live collector_cloud_take claim and collector_cloud_commit RPC.
"""
import argparse
import datetime as dt
import json
import hashlib
import uuid
from pathlib import Path
from .core import HttpClient, FetchError, canonical_url, collect, fetch_listing
from . import parsers
from . import extraction

ROOT = Path(__file__).resolve().parents[2]
def validate_claim(claim):
    if claim.get('slug') not in ('oecd', 'ftc'):
        configs=json.loads((ROOT/'config/trend-collector.json').read_text())['sources']
        if not any(c['source']==claim.get('slug') and c['source_id']==claim.get('source_id') and c.get('enabled') and c.get('executor')=='cloud-python' for c in configs):
            raise ValueError('cloud_source_not_assigned')
    expires = dt.datetime.fromisoformat(claim['lease_until'].replace('Z', '+00:00'))
    if expires <= dt.datetime.now(dt.timezone.utc):
        raise ValueError('lease_expired')


class PreparedStore:
    def __init__(self, cursor, listing_seen_hashes=None):
        self.cursor = cursor
        self.operations = []
        self.complete = False
        self.failure = None
        self.listing_seen_hashes = listing_seen_hashes
        # Pure collector unit tests and non-cloud adapters use the legacy cursor
        # contract. The cloud entry point opts into the DB-backed snapshot path.
        self.snapshot_enabled = False
        self.listing_snapshot = None
        self.snapshot_ref = None

    def stage_listing(self, config, listing_url, fingerprint, rows):
        if config.get('source') != 'ftc':
            raise FetchError('listing_snapshot_source_not_supported')
        if not isinstance(rows, list) or not rows:
            raise FetchError('ftc_listing_snapshot_empty')
        try:
            listing_url=canonical_url(listing_url,set(config['hosts']))
        except ValueError:
            raise FetchError('ftc_listing_snapshot_listing_url_unapproved') from None
        legacy_listing='https://www.ftc.gov/feeds/press-release-consumer-protection.xml'
        current_listing='https://search.ftc.gov/news-events/news/press-releases?search=privacy&items_per_page=50&field_mission%5B29%5D=29'
        configured_listing=config.get('listing')
        try:
            configured_listing=canonical_url(configured_listing,set(config['hosts'])) if configured_listing else None
        except ValueError:
            configured_listing=None
        legacy_listing=canonical_url(legacy_listing,set(config['hosts']))
        current_listing=canonical_url(current_listing,set(config['hosts']))
        if listing_url not in (configured_listing,current_listing,legacy_listing) or not isinstance(fingerprint,str) or len(fingerprint)!=64:
            raise FetchError('ftc_listing_snapshot_schema_invalid')
        normalized=[]; seen=set()
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get('url'), str) or not isinstance(row.get('title'), str):
                raise FetchError('ftc_listing_snapshot_schema_invalid')
            try:
                url=canonical_url(row['url'],set(config['hosts']))
            except ValueError:
                raise FetchError('ftc_listing_snapshot_unapproved_url') from None
            if url in seen:
                raise FetchError('ftc_listing_snapshot_schema_invalid')
            seen.add(url)
            observations=row.get('date_observations',[])
            if not isinstance(observations,list):
                raise FetchError('ftc_listing_snapshot_schema_invalid')
            normalized_row={'url':url,'title':row['title'],'date_observations':observations}
            normalized.append(normalized_row)
        snapshot={
            'id':str(uuid.uuid4()),'listing_url':listing_url,'fingerprint':fingerprint,
            'rows':normalized,
        }
        cursor={key:value for key,value in (self.cursor or {}).items() if key!='processed_url_hashes'}
        cursor.update(page=listing_url,offset=0,fingerprint=fingerprint,snapshot_id=snapshot['id'])
        self.listing_snapshot=snapshot
        self.cursor=cursor

    def set_snapshot_ordinal(self, ordinal):
        if self.listing_snapshot:
            self.snapshot_ref={'id':self.listing_snapshot['id'],'ordinal':ordinal}

    def resume(self, config, since, until):
        return self.cursor

    def ingest(self, config, url, item):
        if self.operations:
            raise ValueError('one_document_per_commit_required')
        self.operations.append({
            'p_source_id': config['source_id'], 'p_external_id': None,
            'p_canonical_url': url, 'p_title_original': item['title_original'],
            'p_published_at': item['published_date']+'T00:00:00Z' if item['published_date'] else None,
            'p_event_date': None, 'p_fetched_at': None,
            'p_language_code': config.get('language', 'en'),
            'p_document_type': 'press_release' if '/press-releases/' in url else 'news',
            'p_content_text': item['content_text'], 'p_content_hash': item['content_hash'],
            'p_raw_storage_path': None, 'p_metadata': item['metadata'],
            'p_instruction_version': 'trend-ko-v1',
        })
        # collect's provisional counters are removed from the output below.
        return {}

    def discovery_failure(self, config, url, title, error):
        self.failure = {'url': url, 'title': title, 'reason': error}

    def progress(self, config, since, until, cursor):
        self.cursor = cursor

    def checkpoint(self, config, until):
        self.complete = True


def prepare(claim):
    validate_claim(claim)
    registry = json.loads((ROOT/'config/trend-collector.json').read_text())
    config = next(c for c in registry['sources'] if c['source'] == claim['slug'])
    if config['source_id'] != claim['source_id']:
        raise ValueError('claim_source_mismatch')
    store = PreparedStore(claim['cursor'],claim.get('previous_listing_hashes'))
    store.snapshot_enabled = claim.get('snapshot_protocol') == 1 and claim['slug'] == 'ftc'
    client = HttpClient(config['hosts'], interval=2)
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    backlog = bool(claim.get('backlog_id'))
    # On the first claim, persist the bounded listing by itself. No detail
    # request happens until this stage commit has made the exact order durable.
    snapshot_start_error=None
    if (not backlog and store.snapshot_enabled and not claim.get('snapshot') and
            not (claim.get('cursor') or {}).get('snapshot_id')):
        listing=config['listing']
        try:
            rows,_=fetch_listing('ftc',client,listing)
            fingerprint=hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()
            store.stage_listing(config,listing,fingerprint,rows)
        except (FetchError,ValueError) as error:
            snapshot_start_error=str(error)
    if backlog:
        detail = claim['detail']
        result = {'source': claim['slug'], 'since': claim['since'], 'until': claim['until'],
                  'coverage_complete': False, 'status': 'partial', 'reason': 'backlog_detail_saved'}
        try:
            if claim['slug'] in ('npc-ph', 'nl-ap'):
                # These official RSS feeds carry a body we can save without
                # fetching linked detail pages. NPC has full content:encoded;
                # NL AP supplies a short summary and blocks detail URLs.
                source_config = next(c for c in json.loads((ROOT/'config/trend-collector.json').read_text())['sources']
                                     if c['source'] == claim['slug'])
                body, feed_url, ctype = client.get(source_config['listing'])
                if ctype not in ('application/rss+xml', 'application/xml', 'text/xml'):
                    raise ValueError('official_rss_content_type_changed')
                rows, _ = parsers.discover_listing(claim['slug'], body.decode('utf-8', 'replace'), feed_url,
                                                  lambda *args: (_ for _ in ()).throw(ValueError('rss_detail_fetch_unexpected')))
                row = next((candidate for candidate in rows if candidate['url'] == detail['url']), None)
                if row is None or not row.get('feed_text'):
                    raise ValueError('claimed_item_missing_rss_body')
                item=(extraction.extract_official_rss_summary(row) if claim['slug']=='nl-ap'
                      else extraction.extract_official_rss_post(row))
                url = detail['url']
                canonical_detail = detail['url']
            else:
                body, url, ctype = client.get(parsers.expansion.detail_request_url(claim['slug'],detail['url']))
                if claim['slug'] in parsers.expansion.ROUTES:
                    parsers.expansion.verify_detail_response(claim['slug'],detail['url'],url)
                canonical_detail=detail['url'] if claim['slug']=='ec' else url
                item = extraction.extract_document(claim['slug'], body, canonical_detail, ctype, detail)
            item['metadata'].update(ai_ready=item['published_date'] is not None and not item['metadata']['requires_review'],
                                    relevance_reason='full_body_available_human_relevance_review_pending')
            if (claim['slug']=='oecd' and parsers.oecd_certainly_outside_window(item,claim['since'],claim['until'])):
                result['reason'] = 'backlog_out_of_range'
                result['range_filter_read_scope'] = 'official_detail_time_observations'
                result['date_observations'] = item['metadata']['date_observations']
            elif item['published_date'] and not claim['since'] <= item['published_date'] <= claim['until']:
                result['reason'] = 'backlog_out_of_range'
            else:
                store.ingest(config, canonical_detail, item)
        except (FetchError, ValueError) as error:
            result.update(status='failed', reason=str(error), failed_url=detail['url'])
    elif snapshot_start_error is not None:
        result={'source':'ftc','since':claim['since'],'until':claim['until'],'status':'failed',
                'reason':snapshot_start_error,'coverage_complete':False,'discovered':0,'new':0,
                'changed':0,'duplicate':0,'held':0,'failed':0,'out_of_range':0,'unknown_date':0,
                'excluded_unapproved_host_count':0,'pages':0}
    elif store.listing_snapshot is not None:
        result={'source':'ftc','since':claim['since'],'until':claim['until'],'status':'partial',
                'reason':'listing_snapshot_staged','coverage_complete':False,'discovered':0,'new':0,
                'changed':0,'duplicate':0,'held':0,'failed':0,'out_of_range':0,'unknown_date':0,
                'excluded_unapproved_host_count':0,'pages':1,'snapshot_rows':len(store.listing_snapshot['rows'])}
    elif claim.get('snapshot'):
        snapshot=claim['snapshot']
        if claim['slug']!='ftc' or snapshot.get('id') != (claim.get('cursor') or {}).get('snapshot_id'):
            raise ValueError('listing_snapshot_claim_mismatch')
        ordinal=snapshot.get('ordinal')
        row_count=snapshot.get('row_count')
        row=snapshot.get('row')
        if type(ordinal) is not int or ordinal<0 or type(row_count) is not int or not 0<row_count or ordinal>=row_count:
            raise ValueError('listing_snapshot_claim_invalid')
        if (claim['cursor'].get('offset') != ordinal or not isinstance(row,dict) or
                not isinstance(row.get('url'),str) or not isinstance(row.get('title'),str)):
            raise ValueError('listing_snapshot_claim_invalid')
        store.snapshot_ref={'id':snapshot['id'],'ordinal':ordinal}
        result={'source':'ftc','status':'partial','reason':None,'coverage_complete':False,
                'since':claim['since'],'until':claim['until'],'discovered':1,'new':0,'changed':0,
                'duplicate':0,'held':0,'failed':0,'out_of_range':0,'unknown_date':0,
                'excluded_unapproved_host_count':0,'pages':0}
        cursor={key:value for key,value in claim['cursor'].items() if key!='processed_url_hashes'}
        url=canonical_url(row['url'],set(config['hosts']))
        if url != row['url']:
            raise ValueError('listing_snapshot_url_not_canonical')
        try:
            legacy_hashes=claim.get('previous_listing_hashes') or cursor.get('processed_url_hashes') or []
            seen_before=snapshot.get('seen_before') is True
            if 'url_hashes' in snapshot:
                row_hash=hashlib.sha256(url.encode()).hexdigest()
                if row_hash not in set(snapshot['url_hashes']):
                    raise ValueError('listing_snapshot_hash_mismatch')
                seen_before=seen_before or row_hash in set(legacy_hashes)
            if seen_before:
                result['duplicate']=1
                result['reason']='previously_seen_url'
            else:
                listing_date=parsers.ftc_listing_date(row)
                if listing_date and not claim['since']<=listing_date<=claim['until']:
                    result['out_of_range']=1
                    result['listing_date_excluded']=1
                    result['range_filter_read_scope']='listing_date_only'
                    result['listing_date_evidence']={'url':url,'date':listing_date,'observations':row.get('date_observations',[])}
                else:
                    body,detail,ctype=client.get(url)
                    item=extraction.extract_document('ftc',body,detail,ctype,row)
                    date=item['published_date']
                    if date and not claim['since']<=date<=claim['until']:
                        result['out_of_range']=1
                    elif date and (listing_date is None and not row.get('date_observations') or date==listing_date):
                        item['metadata'].update(ai_ready=not item['metadata']['requires_review'],
                            relevance_reason='full_body_available_human_relevance_review_pending',
                            pr16_commit='547a83611cad948439598e2974e7ce8afd10781d')
                        store.ingest(config,url,item)
                    else:
                        # A body/listing disagreement or unknown date is preserved
                        # for review and does not become a completed-date assertion.
                        if date is None: result['unknown_date']=1
                        item['metadata'].update(ai_ready=False,requires_review=True,
                            relevance_reason='listing_body_date_unconfirmed')
                        store.ingest(config,url,item)
                        result['held']=1
        except (FetchError,ValueError) as error:
            if str(error).startswith('database_'):
                raise
            store.failure={'url':url,'title':row['title'],'reason':str(error),
                           'cursor':cursor}
            store.cursor={**cursor,'offset':ordinal+1}
            result.update(status='partial',reason='detail_failure_parked',failed=1,failed_url=url)
        else:
            store.cursor={**cursor,'offset':ordinal+1}
            result['reason']='snapshot_item_processed'
        if ordinal+1>=row_count:
            store.cursor={k:v for k,v in store.cursor.items() if k!='snapshot_id'}
            store.cursor.pop('processed_url_hashes',None)
            store.cursor.update(page=snapshot['listing_url'],offset=0,fingerprint=snapshot['fingerprint'],
                                )
            result['listing_scan_complete']=True
            result['reason']='listing_exhaustiveness_unverified_or_unknown_date_or_detail_failure'
        result['coverage_complete']=False
        result['listing_scan_cursor']=store.cursor.get('offset')
    else:
        result = collect(config, client, store, claim['since'], claim['until'], max_pages=1, max_items=1)
        if store.failure and not store.snapshot_ref:
            # The commit RPC must persist this backlog before accepting the advance.
            if claim['slug'] == 'ftc':
                # A durable FTC snapshot owns row identity; retry state lives in
                # the parked failure record rather than an expanding cursor hash list.
                store.cursor.pop('processed_url_hashes',None)
            store.failure['cursor'] = store.cursor
            store.cursor = {**store.cursor, 'offset': store.cursor['offset'] + 1}
            result.update(status='partial', reason='detail_failure_parked', parked_failure=store.failure)
    for field in ('new', 'changed', 'duplicate'):
        result.pop(field, None)
    result.update(runtime='cloud-python-connector', started_at=started,
                  prepared_at=dt.datetime.now(dt.timezone.utc).isoformat(),
                  requests=client.budget['requests'], downloaded_bytes=client.budget['bytes'],
                  saved=False)
    return {'cursor': store.cursor, 'complete': store.complete, 'failure': store.failure,
            'backlog_resolved': backlog and result['status'] != 'failed',
            'operations': store.operations,
            **({'listing_snapshot':store.listing_snapshot} if store.listing_snapshot else {}),
            **({'snapshot_ref':store.snapshot_ref} if store.snapshot_ref else {}),
            'result': result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--claim', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    bundle = prepare(json.loads(Path(args.claim).read_text()))
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(bundle, ensure_ascii=False, indent=2))
    print(json.dumps({'result': bundle['result'], 'prepared_operations': len(bundle['operations'])}, ensure_ascii=False))


if __name__ == '__main__':
    main()
