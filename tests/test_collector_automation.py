"""Execution contract regressions; fake only external DB/network boundaries."""
import contextlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts.collector import run
from scripts.collector.core import FetchError
from scripts.collector.store import SupabaseStore


class AutomationTests(unittest.TestCase):
    def execute(self, configs, store=None, collected=None, flags=('--write',), env=None):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'config').mkdir()
            (root / 'config/trend-collector.json').write_text(json.dumps({'pr16_commit':'test','sources':configs}))
            output = root / 'result.json'
            settings = dict(COLLECTION_ENABLED='true', FREE_LIMITS_VERIFIED='true', CLOUD_PIPELINE_VERIFIED='true')
            settings.update(env or {})
            with patch.object(run, 'ROOT', root), patch.object(run, 'SupabaseStore', return_value=store) as create_store, \
                 patch.object(run, 'collect', return_value=collected) as collect, \
                 patch.dict(os.environ, settings, clear=True), \
                 patch('sys.argv', ['collector', *flags, '--output', str(output)]), \
                 contextlib.redirect_stdout(io.StringIO()):
                code = run.main()
            return code, json.loads(output.read_text()), create_store.call_count, collect.call_count

    def config(self, **kwargs):
        cfg = dict(source='edpb', source_id='a23ccfc6-4ad0-4ae7-bc85-0da35cfd2c1e',
                   enabled=True, permissions=dict(collect=True, store=True, ai=True),
                   hosts=['www.edpb.europa.eu'], listing='https://www.edpb.europa.eu/news_en', hold_reason='original_review_pending')
        cfg.update(kwargs)
        return cfg

    def test_all_disabled_sources_are_blocked_without_database_client(self):
        code, result, created, calls = self.execute([self.config(enabled=False)])
        self.assertEqual(created, 0)
        self.assertEqual(calls, 0)
        self.assertEqual(code, 2)
        self.assertEqual(result['outcome'], 'blocked')
        self.assertEqual(result['sources'][0]['hold_reason'], 'original_review_pending')

    def test_missing_source_id_is_blocked_without_database_client(self):
        code, result, created, calls = self.execute([self.config(source_id=None)])
        self.assertEqual(created, 0)
        self.assertEqual(code, 2)
        self.assertIn('source_id_missing', result['sources'][0]['eligibility_reasons'])

    def test_scheduled_write_requires_explicit_schedule_switch(self):
        code, result, created, calls = self.execute([self.config()], flags=('--write','--scheduled'))
        self.assertEqual(code, 2)
        self.assertEqual(created, 0)
        self.assertEqual(result['stop_reason'], 'schedule_not_enabled')

    def test_database_approval_precedes_range_lookup_and_blocks_collection(self):
        class Store:
            run_id='test'
            def preflight(self, cfg): return {'allowed': False, 'reason': 'database_source_approval_missing'}
            def range_start(self, *args): raise AssertionError('range lookup before approval')
            def record_run(self, *args): raise AssertionError('held-only DB log write')
        code, result, created, calls = self.execute([self.config()], Store())
        self.assertEqual(code, 2)
        self.assertEqual(calls, 0)
        self.assertEqual(result['sources'][0]['reason'], 'database_source_approval_missing')

    def test_partial_collection_is_nonzero_and_preserves_run_log(self):
        class Store:
            run_id='test'
            recorded=False
            def preflight(self, cfg): return {'allowed':True}
            def range_start(self, *args): return '2026-10-01'
            def record_run(self, result): self.recorded=True
        store=Store()
        code, result, created, calls = self.execute([self.config()], store,
            dict(source='edpb', status='partial', coverage_complete=False, reason='unverified'))
        self.assertEqual(code, 3)
        self.assertEqual(result['outcome'], 'partial')
        self.assertTrue(store.recorded)

    def test_capacity_stop_does_not_attempt_database_run_log(self):
        class Store:
            run_id='test'
            def preflight(self, cfg): return {'allowed':True}
            def range_start(self, *args): return '2026-10-01'
            def record_run(self, result): raise AssertionError('write after capacity stop')
        code, result, created, calls = self.execute([self.config()], Store(),
            dict(source='edpb', status='failed', coverage_complete=False, reason='database_storage_cap'))
        self.assertEqual(code, 1)
        self.assertEqual(result['run_log']['status'], 'skipped')

    def test_progress_rpc_failure_is_preserved_in_result_file(self):
        class Store:
            run_id='test'
            def preflight(self, cfg): return {'allowed':True}
            def range_start(self, *args): raise FetchError('database_rpc_failure:collector_get_progress')
            def record_run(self, result): pass
        code, result, created, calls = self.execute([self.config()], Store())
        self.assertEqual(code, 1)
        self.assertEqual(result['sources'][0]['status'], 'failed')
        self.assertEqual(calls, 0)

    def test_preflight_checks_approval_before_capacity(self):
        calls=[]
        class Store(SupabaseStore):
            def __init__(self): pass
            def rpc(self, name, payload):
                calls.append(name)
                return True if name=='collector_source_allowed' else {'can_write':True,'database_bytes':1}
        result=Store().preflight(self.config())
        self.assertTrue(result['allowed'])
        self.assertEqual(calls, ['collector_source_allowed','collector_capacity'])

    def test_database_run_log_failure_changes_execution_outcome(self):
        class Store:
            run_id='test'
            def preflight(self, cfg): return {'allowed':True}
            def range_start(self, *args): return '2026-10-01'
            def record_run(self, result): raise FetchError('database_rpc_failure:collector_record_run')
        code, result, created, calls = self.execute([self.config()], Store(),
            dict(source='edpb', status='success', coverage_complete=True, reason=None))
        self.assertEqual(code, 1)
        self.assertEqual(result['outcome'], 'failed')
        self.assertEqual(result['run_log']['status'], 'failed')

    def test_scheduled_range_resumes_previous_day_cursor(self):
        class Store(SupabaseStore):
            def __init__(self): pass
            def rpc(self, name, payload):
                return {'range_start':'2026-10-01','range_end':'2026-10-12','cursor':{'page':'https://www.edpb.europa.eu/news_en'}}
        self.assertEqual(Store().scheduled_range(self.config(), '2026-10-13'), ('2026-10-01','2026-10-12'))

    def test_detail_failure_retries_same_item_instead_of_skipping(self):
        from scripts.collector.core import collect
        cfg=self.config()
        class Client:
            failed=True
            fetched=[]
            def get(self, url):
                if url.endswith('news_en'):
                    return b'<main><a href="/news/a_en">A</a><a href="/news/b_en">B</a></main>',url,'text/html'
                self.fetched.append(url)
                if self.failed: raise FetchError('http_503')
                return b'<h2 class="node-article-full__title">A</h2><time class="node-article-full__date">7 October 2026</time><div class="node-article-full__body">Data protection policy.</div>',url,'text/html'
        class Store:
            cursor=None
            def resume(self,*args): return self.cursor
            def progress(self,cfg,since,until,cursor): self.cursor=cursor
            def discovery_failure(self,*args): pass
            def ingest(self,*args): return {'item_created':True}
            def checkpoint(self,*args): raise AssertionError('single listing must stay incomplete')
        client=Client(); store=Store()
        first=collect(cfg,client,store,'2026-10-01','2026-10-13')
        self.assertIsNotNone(store.cursor, 'failed detail must retain a retry cursor')
        self.assertEqual(store.cursor['offset'],0)
        self.assertEqual(first['status'],'failed')
        self.assertEqual(first['failed_url'],'https://www.edpb.europa.eu/news/a_en')
        client.failed=False
        second=collect(cfg,client,store,'2026-10-01','2026-10-13')
        self.assertEqual(client.fetched,['https://www.edpb.europa.eu/news/a_en','https://www.edpb.europa.eu/news/a_en','https://www.edpb.europa.eu/news/b_en'])
        self.assertEqual(second['failed'],0)

    def test_unknown_date_in_paginated_listing_never_advances_checkpoint(self):
        from scripts.collector.core import collect
        class Client:
            def get(self,url):
                if url.endswith('news_en'): html='<main><a href="/news/a_en">A</a><a rel="next" href="/news_en?page=1">Next</a></main>'
                elif '?page=1' in url: html='<main><a href="/news/b_en">B</a></main>'
                else: html='<h2 class="node-article-full__title">A</h2><div class="node-article-full__body">Data protection policy.</div>'
                return html.encode(),url,'text/html'
        class Store:
            checkpointed=False
            def ingest(self,*args): return {'item_created':True}
            def discovery_failure(self,*args): pass
            def checkpoint(self,*args): self.checkpointed=True
        store=Store();result=collect(self.config(),Client(),store,'2026-10-01','2026-10-13')
        self.assertFalse(result['coverage_complete'])
        self.assertFalse(store.checkpointed)

    def test_run_log_rechecks_capacity_before_writing(self):
        calls=[]
        class Store(SupabaseStore):
            run_id='test'
            def __init__(self): pass
            def rpc(self,name,payload):
                calls.append(name)
                return {'can_write':False}
        with self.assertRaisesRegex(FetchError,'database_storage_cap'):
            Store().record_run({})
        self.assertEqual(calls,['collector_capacity'])

    def test_preflight_unapproved_source_does_not_read_capacity(self):
        calls=[]
        class Store(SupabaseStore):
            def __init__(self): pass
            def rpc(self,name,payload): calls.append(name); return False
        result=Store().preflight(self.config())
        self.assertFalse(result['allowed'])
        self.assertEqual(calls,['collector_source_allowed'])

    def test_operation_gate_off_is_logged_without_database_client(self):
        code,result,created,calls=self.execute([self.config()],env={'FREE_LIMITS_VERIFIED':'false'})
        self.assertEqual(code,2)
        self.assertEqual(created,0)
        self.assertEqual(result['stop_reason'],'operation_cost_or_pipeline_checks_missing')

    def test_scheduled_cli_uses_stored_range_after_preflight(self):
        class Store:
            run_id='test'
            def preflight(self,cfg): return {'allowed':True}
            def scheduled_range(self,cfg,until): return '2026-10-01','2026-10-12'
            def range_start(self,*args): raise AssertionError('scheduled must preserve existing range')
            def record_run(self,*args): pass
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'config').mkdir()
            (root/'config/trend-collector.json').write_text(json.dumps({'pr16_commit':'test','sources':[self.config()]}))
            with patch.object(run,'ROOT',root),patch.object(run,'SupabaseStore',return_value=Store()), \
                 patch.object(run,'collect',return_value={'source':'edpb','status':'success','coverage_complete':True,'reason':None}) as collect, \
                 patch.dict(os.environ,dict(SCHEDULE_ENABLED='true',COLLECTION_ENABLED='true',FREE_LIMITS_VERIFIED='true',CLOUD_PIPELINE_VERIFIED='true'),clear=True), \
                 patch('sys.argv',['collector','--write','--scheduled','--output',str(root/'result.json')]),contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(run.main(),0)
            self.assertEqual(collect.call_args.args[3:5],('2026-10-01','2026-10-12'))
