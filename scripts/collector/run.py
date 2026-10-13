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

ROOT=Path(__file__).resolve().parents[2]
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
            record={'source':config['source'],'status':'held','coverage_complete':False,'requests':[]}
            # A bounded diagnostic, not authorization to turn a source on.
            researched=json.loads((ROOT/f"data/trends/source-configs/{config['source']}.json").read_text())
            urls=list(dict.fromkeys([config['listing']]+researched.get('sample_urls',[])[:1]))
            for url in urls:
                try:
                    body,final,ctype=client.get(url)
                    record['requests'].append({'url':url,'final_url':final,'status':'fetched','bytes':len(body),'content_type':ctype})
                except (FetchError,ValueError) as e:
                    record['requests'].append({'url':url,'status':'failed','reason':str(e)}); failure=True
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
