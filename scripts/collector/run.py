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

def main():
    p=argparse.ArgumentParser(description='No paid AI API. Default is held/dry-run.')
    p.add_argument('--write',action='store_true'); p.add_argument('--probe',action='store_true')
    p.add_argument('--source'); p.add_argument('--since'); p.add_argument('--until',default=dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date().isoformat())
    p.add_argument('--max-pages',type=int,default=10); p.add_argument('--max-items',type=int,default=30)
    p.add_argument('--output',default='work/collector-result.json')
    args=p.parse_args()
    dt.date.fromisoformat(args.until)
    if args.since and dt.date.fromisoformat(args.since)>dt.date.fromisoformat(args.until): p.error('since must precede until')
    if not 1<=args.max_pages<=50 or not 1<=args.max_items<=100: p.error('bounded page/item limits required')
    if args.probe and args.write: p.error('probe never writes to Supabase')
    if args.write and not all(os.environ.get(k)=='true' for k in ('COLLECTION_ENABLED','FREE_LIMITS_VERIFIED','CLOUD_PIPELINE_VERIFIED')):
        p.error('operation/cost/end-to-end checks missing; writing disabled')
    registry=json.loads((ROOT/'config/trend-collector.json').read_text())
    configs=[c for c in registry['sources'] if not args.source or c['source']==args.source]
    if not configs: p.error('unknown source')
    store=SupabaseStore() if args.write else DryStore()
    result={'run_id':getattr(store,'run_id',str(uuid.uuid4())),'started_at':dt.datetime.now(dt.timezone.utc).isoformat(),
      'mode':'probe' if args.probe else 'write' if args.write else 'dry_run','pr16_commit':registry['pr16_commit'],'sources':[]}
    failure=False
    budget={'requests':0,'bytes':0,'started':time.monotonic()}
    for config in configs:
        since=args.since or (store.range_start(config,args.until) if args.write else (dt.date.fromisoformat(args.until)-dt.timedelta(days=7)).isoformat())
        client=HttpClient(config['hosts'],interval=6 if config['source']=='ico' else 2,budget=budget)
        if args.probe:
            # A bounded diagnostic, not authorization to turn a source on.
            researched=json.loads((ROOT/f"data/trends/source-configs/{config['source']}.json").read_text())
            record,probe_failed=probe_source(config,client,researched.get('sample_urls',[])[:1])
            failure=failure or probe_failed
            result['sources'].append(record)
        else:
            record=collect(config,client,store,since,args.until,args.max_pages,args.max_items)
            result['sources'].append(record); failure=failure or record['status']=='failed'
    result['finished_at']=dt.datetime.now(dt.timezone.utc).isoformat()
    result['requests']=budget['requests'];result['downloaded_bytes']=budget['bytes']
    result['stop_reason']='failures_or_source_approvals_pending' if failure or any(r['status']=='held' for r in result['sources']) else None
    # One compact bounded log per execution; raw HTML/PDF and secret values are omitted.
    output=Path(args.output); output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(result,ensure_ascii=False,indent=2))
    if args.write: store.record_run(result)
    print(json.dumps({'run_id':result['run_id'],'mode':result['mode'],'sources':[{k:v for k,v in r.items() if k not in ('requests',)} for r in result['sources']]},ensure_ascii=False))
    return 1 if failure else 0

if __name__=='__main__': sys.exit(main())
