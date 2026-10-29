import asyncio
import base64
import contextlib
import importlib.util
import io
import json
import os
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

spec = importlib.util.spec_from_file_location('podcast_worker', Path(__file__).parents[1] / 'scripts/podcast-cloud/worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
vault_spec = importlib.util.spec_from_file_location('session_store', Path(__file__).parents[1] / 'scripts/podcast-cloud/session_store.py')
session_store = importlib.util.module_from_spec(vault_spec)
vault_spec.loader.exec_module(session_store)
EMAIL = 'podcast@example.invalid'
KEY = base64.b64encode(bytes(range(32))).decode()
def state(value='initial-secret'):
    return json.dumps({'cookies':[{'name':'SID','value':value},{'name':'__Secure-1PSIDTS','value':value}],
                       'notebooklm':{'account':{'email':EMAIL}}}).encode()

class SessionCryptoTests(unittest.TestCase):
    def test_ciphertext_is_random_and_authenticated_for_version_and_key(self):
        v=session_store.SessionVault(KEY,EMAIL)
        a=v.seal(state(),1); b=v.seal(state(),1)
        self.assertNotEqual(a['nonce'],b['nonce'])
        self.assertNotIn('initial-secret',json.dumps(a))
        self.assertEqual(v.unseal(a,1),state())
        for bad in ({**a,'ciphertext':a['ciphertext'][:-4]+'AAAA'}, {**a,'nonce':'A'*16}):
            with self.assertRaises(ValueError): v.unseal(bad,1)
        with self.assertRaises(ValueError): v.unseal(a,2)
        with self.assertRaises(ValueError):
            session_store.SessionVault(base64.b64encode(b'x'*32).decode(),EMAIL).unseal(a,1)

    def test_account_mismatch_and_existing_ciphertext_never_fall_back_to_bootstrap(self):
        with self.assertRaises(ValueError): session_store.SessionVault(KEY,'other@example.invalid').seal(state(),1)
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                session_store.SessionVault(KEY,EMAIL,state()).restore(folder,{'version':1,'envelope':{}})

    def test_explicit_admin_recovery_preserves_version_and_rejects_other_accounts(self):
        v=session_store.SessionVault(KEY,EMAIL)
        recovery=json.loads(state('new-dedicated-login'))
        with tempfile.TemporaryDirectory() as folder:
            p=v.restore(folder,{'version':12,'envelope':{},'recovery':recovery})
            self.assertEqual(json.loads(p.read_bytes()),recovery)
            self.assertEqual(v.unseal(v.seal(p.read_bytes(),13),13),p.read_bytes())
        recovery['notebooklm']['account']['email']='other@example.invalid'
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError): v.restore(folder,{'version':12,'recovery':recovery})

    def test_restore_is_private_and_forces_rotation_guard_to_expire(self):
        with tempfile.TemporaryDirectory() as folder:
            p=session_store.SessionVault(KEY,EMAIL,state()).restore(folder,{'version':0,'envelope':None})
            self.assertEqual(p.stat().st_mtime,1)
            if os.name != 'nt': self.assertEqual(p.stat().st_mode & 0o777,0o600)
            with self.assertRaises(FileExistsError):
                session_store.SessionVault(KEY,EMAIL,state()).restore(folder,{'version':0,'envelope':None})

    def test_secrets_are_removed_from_environment_before_sdk_load(self):
        with patch.dict(os.environ,{'PODCAST_SESSION_KEY':KEY,'PODCAST_ACCOUNT_EMAIL':EMAIL,'NOTEBOOKLM_AUTH_JSON':state().decode()}):
            session_store.SessionVault.from_environment()
            self.assertFalse(any(k in os.environ for k in ('PODCAST_SESSION_KEY','PODCAST_ACCOUNT_EMAIL','NOTEBOOKLM_AUTH_JSON')))

class SessionRunTests(unittest.IsolatedAsyncioTestCase):
    def cloud(self):
        cloud=types.SimpleNamespace(calls=[])
        def call(action,job=None,**kw):
            cloud.calls.append((action,kw))
            return {'job':None}
        cloud.call=call
        return cloud

    def factory(self, seen, error=None):
        @contextlib.asynccontextmanager
        async def factory(path):
            seen.append(Path(path).read_bytes())
            client=types.SimpleNamespace(notebooks=types.SimpleNamespace(list=AsyncMock(side_effect=error)))
            yield client
            Path(path).write_bytes(state('rotated-secret'))
        return factory

    async def test_independent_runners_use_saved_rotation_and_auth_trial_cannot_claim_jobs(self):
        cloud=self.cloud(); seen=[]
        vault=session_store.SessionVault(KEY,EMAIL,state())
        result=await worker.run_session(cloud,vault,{'version':0,'envelope':None,'auth_only':True},self.factory(seen),True)
        self.assertEqual(result,0)
        self.assertNotIn('claim',[a for a,k in cloud.calls])
        saved=next(k['data']['envelope'] for a,k in cloud.calls if a=='session_save')
        next_cloud=self.cloud()
        await worker.run_session(next_cloud,session_store.SessionVault(KEY,EMAIL),
             {'version':1,'envelope':saved,'auth_only':True},self.factory(seen))
        self.assertEqual(seen,[state(),state('rotated-secret')])

    async def test_failed_auth_does_not_overwrite_last_good_ciphertext_or_leak_error(self):
        class AuthError(Exception): pass
        cloud=self.cloud(); captured=io.StringIO()
        with contextlib.redirect_stdout(captured):
            result=await worker.run_session(cloud,session_store.SessionVault(KEY,EMAIL,state()),
                 {'version':0,'envelope':None,'auth_only':True},self.factory([],AuthError('secret-must-not-appear')))
        self.assertEqual(result,1)
        self.assertNotIn('session_save',[a for a,k in cloud.calls])
        self.assertEqual(next(k for a,k in cloud.calls if a=='session_fail')['data']['category'],'auth')
        self.assertNotIn('secret-must-not-appear',captured.getvalue())

    async def test_extraction_failure_is_not_reported_as_expired_login(self):
        class AuthExtractionError(Exception): pass
        cloud=self.cloud(); captured=io.StringIO()
        with contextlib.redirect_stdout(captured):
            await worker.run_session(cloud,session_store.SessionVault(KEY,EMAIL,state()),
                {'version':0,'envelope':None,'auth_only':True},
                self.factory([],AuthExtractionError('secret-response-body')))
        self.assertFalse(worker.auth_failure(AuthExtractionError()))
        self.assertIn('reason=token_extraction',captured.getvalue())
        self.assertIn('stage=list_notebooks',captured.getvalue())
        self.assertNotIn('secret-response-body',captured.getvalue())
        self.assertNotIn(('health',{'ok':False}),cloud.calls)

    def test_diagnostic_codes_never_include_sdk_messages(self):
        error=ValueError("Google's CookieMismatch page was reached secret-url-cookie")
        self.assertEqual(worker.failure_reason(error),'cookie_scope')
        self.assertEqual(worker.failure_reason(ValueError('secret-value')),'unclassified')

    async def test_non_auth_production_failure_still_persists_verified_rotation(self):
        cloud=self.cloud(); original_call=cloud.call
        def call(action,job=None,**kw):
            value=original_call(action,job,**kw)
            return {'job':{'id':'synthetic','cloud_checkpoint':{}}} if action=='claim' else value
        cloud.call=call
        with patch.object(worker,'produce',AsyncMock(side_effect=RuntimeError('production failure'))):
            result=await worker.run_session(cloud,session_store.SessionVault(KEY,EMAIL,state()),
                {'version':0,'envelope':None,'auth_only':False},self.factory([]),True)
        self.assertEqual(result,1)
        self.assertIn('session_save',[a for a,k in cloud.calls])
        self.assertNotIn('session_fail',[a for a,k in cloud.calls])

class Cloud:
    def __init__(self):
        self.calls = []
    def checkpoint(self, job, cp, phase, message=''):
        self.calls.append(('checkpoint', phase, dict(cp)))
        job['cloud_checkpoint'] = dict(cp)
    def call(self, action, job):
        self.calls.append((action,))
    def upload(self, job, path):
        assert path.exists()
        self.calls.append(('complete',))

def job(cp=None):
    return {'id':'test-job','packet':{'issueKey':'2026-W43','sourceText':'public sources','instructions':'one main topic'},'cloud_checkpoint':cp or {}}

class PodcastCloudTests(unittest.IsolatedAsyncioTestCase):
    def client(self, status):
        return types.SimpleNamespace(
            notebooks=types.SimpleNamespace(create=AsyncMock(return_value=types.SimpleNamespace(id='nb'))),
            sources=types.SimpleNamespace(add_text=AsyncMock(return_value=types.SimpleNamespace(id='src'))),
            artifacts=types.SimpleNamespace(generate_audio=AsyncMock(return_value=types.SimpleNamespace(task_id='audio',is_failed=False)),poll_status=AsyncMock(return_value=status),download_audio=AsyncMock()))

    async def test_first_run_persists_ids_and_completes(self):
        client=self.client(types.SimpleNamespace(is_complete=True))
        async def download(nb,path,artifact_id):
            Path(path).write_bytes(b'fake audio')
        client.artifacts.download_audio.side_effect=download
        cloud=Cloud(); j=job()
        await worker.produce(client,cloud,j)
        self.assertEqual(j['cloud_checkpoint']['artifact_id'],'audio')
        self.assertEqual(cloud.calls[-1],('complete',))
        self.assertEqual(client.artifacts.generate_audio.await_args.kwargs['language'],'ko')
        self.assertEqual(client.artifacts.generate_audio.await_args.kwargs['source_ids'],['src'])

    async def test_next_run_polls_exact_existing_audio_without_regeneration(self):
        client=self.client(types.SimpleNamespace(is_complete=False,is_terminal=False))
        cloud=Cloud(); ticks=iter([0,0,400])
        await worker.produce(client,cloud,job({'notebook_id':'nb','source_id':'src','artifact_id':'original','stage':'watch'}),clock=lambda:next(ticks),sleep=AsyncMock())
        client.notebooks.create.assert_not_awaited()
        client.sources.add_text.assert_not_awaited()
        client.artifacts.generate_audio.assert_not_awaited()
        client.artifacts.poll_status.assert_awaited_once_with('nb','original')
        self.assertEqual(cloud.calls[-1],('release',))

    async def test_uncertain_external_creation_is_not_repeated(self):
        for stage in worker.AMBIGUOUS:
            cloud=Cloud();client=self.client(None)
            await worker.produce(client,cloud,job({'stage':stage}))
            client.notebooks.create.assert_not_awaited()
            client.artifacts.generate_audio.assert_not_awaited()
            self.assertEqual(cloud.calls[-1][1],'blocked')

    async def test_cancelled_lease_stops_before_google_mutations(self):
        cloud=Cloud();client=self.client(None)
        cloud.checkpoint=lambda *a: (_ for _ in ()).throw(RuntimeError('cancelled'))
        with self.assertRaises(RuntimeError):
            await worker.produce(client,cloud,job())
        client.notebooks.create.assert_not_awaited()

if __name__=='__main__':
    unittest.main()
