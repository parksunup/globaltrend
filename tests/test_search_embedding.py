"""Offline protocol/cache tests; no model packages, network or weights needed."""
import importlib.util
import json
from pathlib import Path
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location('embedding_server', Path(__file__).parents[1] / 'scripts/search/embedding_server.py')
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)

class Vectors:
    def __init__(self, values): self.values = values
    def __matmul__(self, other): return self.values

class Model:
    def __init__(self): self.tokenizer = self; self.passage_calls = 0
    def encode(self, values, **kwargs):
        if isinstance(values, str): return list(values)
        if values[0].startswith('query: '): return [1]
        self.passage_calls += 1
        return Vectors([.9 for _ in values])
    def decode(self, tokens, **kwargs): return ''.join(tokens)

class SearchEmbeddingTests(unittest.TestCase):
    def test_payload_rejects_duplicate_ids_and_invalid_questions(self):
        for payload in ({'query': '', 'documents': []}, {'query': 'x', 'documents': [{'id': 'a', 'text': 'x'}] * 2}, {'query': 'x', 'documents': [{'id': 'a', 'text': None}]}):
            with self.assertRaises(ValueError): service.parse_payload(payload)

    def test_cache_tracks_content_and_withdrawals_and_groups_passages(self):
        model = Model()
        encoder = service.Encoder(model)
        docs = [{'id': 'a', 'text': 'x' * 800}, {'id': 'b', 'text': 'y'}]
        self.assertEqual([h['id'] for h in encoder.search('first', docs)], ['a', 'b'])
        encoder.search('second', docs)
        self.assertEqual(model.passage_calls, 1)
        docs[0]['text'] = 'revised'
        encoder.search('third', docs)
        self.assertEqual(model.passage_calls, 2)
        self.assertEqual([h['id'] for h in encoder.search('fourth', docs[:1])], ['a'])
        self.assertEqual(len(encoder.cache), 2)

    def test_http_auth_limits_and_generic_errors(self):
        class Encoder:
            def search(self, query, documents):
                if query == 'fail': raise RuntimeError('private server detail')
                return [{'id': documents[0]['id'], 'score': .9}]
        server = service.ThreadingHTTPServer(('127.0.0.1', 0), service.handler_for(Encoder(), 'secret'))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        def call(query, token='secret', size=None):
            data = json.dumps({'query': query, 'documents': [{'id': 'a', 'text': 'public'}]}).encode()
            headers = {'Authorization': 'Bearer ' + token}
            if size: headers['Content-Length'] = str(size)
            request = Request(f'http://127.0.0.1:{server.server_port}/search', data=data, headers=headers)
            try:
                with urlopen(request, timeout=3) as response: return response.status, json.load(response)
            except HTTPError as response: return response.code, json.load(response)
        try:
            self.assertEqual(call('x')[0], 200)
            self.assertEqual(call('x', 'wrong')[0], 401)
            self.assertEqual(call('x', size=service.MAX_BYTES + 1)[0], 413)
            self.assertEqual(call('fail'), (503, {'error': 'encoder unavailable'}))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

if __name__ == '__main__': unittest.main()
