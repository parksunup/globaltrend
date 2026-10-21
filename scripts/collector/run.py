import argparse
import datetime as dt
import json
import os
import sys
import uuid
import time
from pathlib import Path
from .core import collect,HttpClient,FetchError
from .store import SupabaseStore,DryStore
from . import parsers

ROOT=Path(__file__).resolve().parents[2]
def probe_source(config,client,sample_urls):
    """Robots-aware listing and one detail; no writes or approval changes.

    Current discovered URLs take priority over historical research samples.
    Parser failures are distinct from an HTTP response being received.
    """
    record={'source':config['source'],'status':'held','coverage_complete':False,'requests':[]}
    failed=False; rows=[]; listing=config['listing']
    def fetch(url,method='GET',payload=None):
        try:
            body,final,ctype=client.post(url,payload,{'Content-Type':'application/json'}) if method=='POST' else client.get(url)
        except (FetchError,ValueError) as e:
            record['requests'].append({'url':url,'status':'failed','reason':str(e)})
            raise
        record['requests'].append({'url':url,'final_url':final,'status':'fetched','bytes':len(body),'content_type':ctype})
        return body,final,ctype
    try:
        body,final,ctype=fetch(listing)
        if ctype not in ('text/html','application/xhtml+xml','application/rss+xml','text/xml','application/xml'):
            raise ValueError('unsupported_listing_type')
        if ctype in ('text/html','application/xhtml+xml'):
            # Bounded public-page diagnostics help distinguish a changed site
            # template from an access/challenge page; never store the response.
            document=parsers.BeautifulSoup(body.decode('utf-8','replace'),'html.parser')
            title=document.select_one('title')
            record['listing_document']={
                'title':parsers.normalize(title.get_text())[:200] if title else None,
                'language':document.html.get('lang') if document.html else None,
                'challenge_marker':b'cf_chl_opt' in body or b'/cdn-cgi/challenge-platform/' in body,
            }
            if not title and not document.select_one('main,article,h1'):
                record['listing_document']['non_article_text']=parsers.normalize(document.get_text())[:200]
        rows,next_page=parsers.discover_listing(config['source'],body.decode('utf-8','replace'),final,fetch)
        if not rows: raise ValueError('listing_empty_or_structure_changed')
        record['listing']={'status':'parsed','discovered':len(rows),'next_url':next_page}
    except (FetchError,ValueError) as e:
        record['listing']={'status':'failed','reason':str(e)}; failed=True
    row=rows[0] if rows else ({'url':sample_urls[0]} if sample_urls else None)
    if row:
        try:
            body,final,ctype=fetch(row['url'])
            item=parsers.extract_document(config['source'],body,final,ctype,row)
            record['detail']={'status':'parsed','url':final,'sample_origin':'current_listing' if rows else 'research_sample',
                'content_characters':len(item['content_text']),'published_date':item['published_date'],
                'read_scope':item['metadata']['read_scope'],'requires_review':item['metadata']['requires_review'],
                'date_observations':item['metadata']['date_observations'],
                'unread_document_count':len(item['metadata']['unread_attachments'])}
        except (FetchError,ValueError) as e:
            record['detail']={'status':'failed','reason':str(e)}; failed=True
    else:
        record['detail']={'status':'unrun','reason':'no_current_or_research_sample'}
    return record,failed

def source_eligibility(config, require_id=False):
    reasons=[]
    if not config.get('enabled'): reasons.append('source_disabled')
    for permission in ('collect','store','ai'):
        if config.get('permissions',{}).get(permission) is not True:
            reasons.append('source_'+permission+'_unapproved')
    if require_id:
        try: uuid.UUID(str(config.get('source_id')))
        except (ValueError,TypeError,AttributeError): reasons.append('source_id_missing_or_invalid' if config.get('source_id') else 'source_id_missing')
    return reasons


def execution_outcome(records):
    if any(r['status']=='failed' for r in records): return 'failed'
    if all(r['status']=='held' for r in records): return 'blocked'
    if any(r['status']!='success' for r in records): return 'partial'
    return 'success'


def main():
    p=argparse.ArgumentParser(description='No paid AI API. Default is held/dry-run.')
    p.add_argument('--write',action='store_true'); p.add_argument('--probe',action='store_true')
    p.add_argument('--scheduled',action='store_true',help='Scheduled write; requires explicit runtime schedule and operation gates')
    p.add_argument('--source'); p.add_argument('--since'); p.add_argument('--until')
    p.add_argument('--max-pages',type=int,default=10); p.add_argument('--max-items',type=int,default=30)
    p.add_argument('--output',default='work/collector-result.json')
    args=p.parse_args()
    explicit_until=args.until
    args.until=args.until or dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date().isoformat()
    dt.date.fromisoformat(args.until)
    if args.since and dt.date.fromisoformat(args.since)>dt.date.fromisoformat(args.until): p.error('since must precede until')
    if not 1<=args.max_pages<=50 or not 1<=args.max_items<=100: p.error('bounded page/item limits required')
    if args.probe and args.write: p.error('probe never writes to Supabase')
    if args.scheduled and (not args.write or args.since or explicit_until): p.error('scheduled mode requires write without range overrides')
    registry=json.loads((ROOT/'config/trend-collector.json').read_text())
    configs=[c for c in registry['sources'] if not args.source or c['source']==args.source]
    if not configs: p.error('unknown source')
    result={'run_id':str(uuid.uuid4()),'started_at':dt.datetime.now(dt.timezone.utc).isoformat(),
      'mode':'probe' if args.probe else 'write' if args.write else 'dry_run','scheduled':args.scheduled,
      'pr16_commit':registry['pr16_commit'],'sources':[], 'run_log':{'status':'skipped','reason':'no_eligible_collection'}}
    global_hold=None
    if args.scheduled and os.environ.get('SCHEDULE_ENABLED')!='true': global_hold='schedule_not_enabled'
    elif args.write and not all(os.environ.get(k)=='true' for k in ('COLLECTION_ENABLED','FREE_LIMITS_VERIFIED','CLOUD_PIPELINE_VERIFIED')):
        global_hold='operation_cost_or_pipeline_checks_missing'
    store=None; attempted=False; database_stop=False; probe_failed=False
    budget={'requests':0,'bytes':0,'started':time.monotonic()}
    for config in configs:
        since=args.since or (dt.date.fromisoformat(args.until)-dt.timedelta(days=7)).isoformat()
        until=args.until
        reasons=source_eligibility(config,require_id=args.write)
        record={'source':config['source'],'status':'held','reason':global_hold or (reasons[0] if reasons else None),
                'eligibility_reasons':reasons,'hold_reason':config.get('hold_reason'),
                'coverage_complete':False,'since':since,'until':until}
        if global_hold or (not args.probe and reasons):
            result['sources'].append(record); continue
        if database_stop:
            record['reason']='database_writes_stopped'; result['sources'].append(record); continue
        try:
            if args.write:
                if store is None:
                    store=SupabaseStore(); result['run_id']=store.run_id
                preflight=store.preflight(config); record['preflight']=preflight
                if not preflight['allowed']:
                    record['reason']=preflight['reason']
                    if record['reason']=='database_storage_cap':
                        record['status']='failed'; database_stop=True
                    result['sources'].append(record); continue
                if args.scheduled:
                    since,until=store.scheduled_range(config,until)
                else:
                    since=args.since or store.range_start(config,until)
                record.update(since=since,until=until)
            client=HttpClient(config['hosts'],interval=6 if config['source']=='ico' else 2,budget=budget)
            if args.probe:
                researched=json.loads((ROOT/f"data/trends/source-configs/{config['source']}.json").read_text())
                probe,failed=probe_source(config,client,researched.get('sample_urls',[])[:1])
                probe.update(eligibility_reasons=reasons,hold_reason=config.get('hold_reason'))
                result['sources'].append(probe); probe_failed=probe_failed or failed
                continue
            attempted=True
            collected=collect(config,client,store or DryStore(),since,until,args.max_pages,args.max_items)
            collected.update(eligibility_reasons=reasons,hold_reason=config.get('hold_reason'))
            if 'preflight' in record: collected['preflight']=record['preflight']
            record=collected
        except (FetchError,ValueError) as e:
            record.update(status='failed',reason=str(e),coverage_complete=False)
        if record.get('reason','') and record['reason'].startswith('database_'):
            database_stop=True
        result['sources'].append(record)
    result['finished_at']=dt.datetime.now(dt.timezone.utc).isoformat()
    result['requests']=budget['requests']; result['downloaded_bytes']=budget['bytes']
    result['outcome']=('failed' if probe_failed else 'diagnostic_success') if args.probe else execution_outcome(result['sources'])
    result['operation_success']=args.write and result['outcome']=='success'
    result['stop_reason']=global_hold or (None if result['outcome'] in ('success','diagnostic_success') else result['outcome'])
    # Never issue a log write after a DB failure/cap or when every source was held.
    if args.write and store is not None and attempted and not database_stop:
        try:
            result['run_log']={'status':'recorded','reason':None}
            store.record_run(result)
        except FetchError as e:
            result['run_log']={'status':'failed','reason':str(e)}
            result.update(outcome='failed',operation_success=False,stop_reason='run_log_failed')
    elif database_stop:
        result['run_log']={'status':'skipped','reason':'database_writes_stopped'}
    # One compact bounded local log even when preflight/progress/run-log RPC fails.
    output=Path(args.output); output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({'run_id':result['run_id'],'mode':result['mode'],'outcome':result['outcome'],
        'operation_success':result['operation_success'],'sources':[{k:v for k,v in r.items() if k!='requests'} for r in result['sources']]},ensure_ascii=False))
    return {'failed':1,'blocked':2,'partial':3}.get(result['outcome'],0)

if __name__=='__main__': sys.exit(main())
