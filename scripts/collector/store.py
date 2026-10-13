"""Server-side Supabase RPC client; keys never enter result files or logs."""
import json
import os
import uuid
from .core import HttpClient,FetchError

class DryStore:
    def ingest(self,config,url,item): return {'item_created':True,'content_changed':True}
    def discovery_failure(self,*args): pass
    def checkpoint(self,*args): pass
    def progress(self,*args): pass
    def resume(self,*args): return None

class SupabaseStore:
    def __init__(self):
        from urllib.parse import urlsplit
        self.base=os.environ.get('SUPABASE_URL','').rstrip('/')
        self.key=os.environ.get('SUPABASE_SECRET_KEY','')
        if self.base!='https://emlgwhkgaihhrirhdpnp.supabase.co' or not self.key:
            raise FetchError('existing_project_or_secret_configuration_missing')
        self.client=HttpClient([urlsplit(self.base).hostname],interval=0)
        self.run_id=str(uuid.uuid4())
    def rpc(self,name,payload):
        try:
            data,_,_=self.client.request(self.base+'/rest/v1/rpc/'+name,'POST',json.dumps(payload,ensure_ascii=False).encode(),
                {'apikey':self.key,'Authorization':'Bearer '+self.key,'Content-Type':'application/json'})
            return json.loads(data)
        except Exception as e: raise FetchError('database_rpc_failure:'+name) from None
    def ingest(self,config,url,item):
        p={'p_source_id':config['source_id'],'p_external_id':None,'p_canonical_url':url,'p_title_original':item['title_original'],
           'p_published_at':item['published_date']+'T00:00:00Z' if item['published_date'] else None,'p_event_date':None,'p_fetched_at':None,
           'p_language_code':config.get('language','en'),
           'p_document_type':'press_release' if item['metadata'].get('read_scope')=='press_release_pdf_not_judgment' else 'news',
           'p_content_text':item['content_text'],
           'p_content_hash':item['content_hash'],'p_raw_storage_path':None,'p_metadata':item['metadata'],'p_instruction_version':'trend-ko-v1'}
        # Read-only mode and conservative storage cap are checked before each body write.
        if not self.rpc('collector_capacity',{}).get('can_write'): raise FetchError('database_storage_cap')
        if not self.rpc('collector_source_allowed',{'p_source_id':config['source_id']}): raise FetchError('database_source_approval_missing')
        return self.rpc('ingest_source_item',p)[0]
    def discovery_failure(self,config,url,title,error):
        # Do not fake a title to satisfy the ingest contract. Unnamed failures remain in run logs.
        if not title: return
        if not self.rpc('collector_capacity',{}).get('can_write'): raise FetchError('database_storage_cap')
        if not self.rpc('collector_source_allowed',{'p_source_id':config['source_id']}): raise FetchError('database_source_approval_missing')
        self.rpc('ingest_source_item',{'p_source_id':config['source_id'],'p_external_id':None,'p_canonical_url':url,'p_title_original':title,
          'p_published_at':None,'p_event_date':None,'p_fetched_at':None,'p_language_code':config.get('language','en'),'p_document_type':'news',
          'p_content_text':None,'p_content_hash':None,'p_raw_storage_path':None,'p_metadata':{'fetch_failure':error,'ai_ready':False},'p_instruction_version':'trend-ko-v1'})
    def checkpoint(self,config,until):
        self.rpc('collector_set_progress',{'p_source_id':config['source_id'],'p_since':None,'p_until':until,'p_cursor':None,'p_complete':True})
    def progress(self,config,since,until,cursor):
        self.rpc('collector_set_progress',{'p_source_id':config['source_id'],'p_since':since,'p_until':until,'p_cursor':cursor,'p_complete':False})
    def resume(self,config,since,until):
        data=self.rpc('collector_get_progress',{'p_source_id':config['source_id']})
        return data.get('cursor') if data.get('range_start')==since and data.get('range_end')==until else None
    def range_start(self,config,until):
        import datetime as dt
        data=self.rpc('collector_get_progress',{'p_source_id':config['source_id']})
        last=data.get('last_success_date')
        return (dt.date.fromisoformat(last)-dt.timedelta(days=3)).isoformat() if last else (dt.date.fromisoformat(until)-dt.timedelta(days=7)).isoformat()
    def record_run(self,result):
        self.rpc('collector_record_run',{'p_run_id':self.run_id,'p_result':result})
