import asyncio
import importlib.util
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock

spec = importlib.util.spec_from_file_location('podcast_worker', Path(__file__).parents[1] / 'scripts/podcast-cloud/worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

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
