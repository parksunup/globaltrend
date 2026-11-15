"""Optional local CPU embedding service. No model download unless explicitly enabled.
Run --help for configuration. The application also works with this service disabled.
"""
import argparse
from collections import OrderedDict
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import threading

MAX_BYTES = 6_000_000
MAX_DOCUMENTS = 6000


def parse_payload(data):
    if not isinstance(data, dict) or not isinstance(data.get('query'), str) or not 1 <= len(data['query']) <= 300:
        raise ValueError('invalid query')
    documents = data.get('documents')
    if not isinstance(documents, list) or not 1 <= len(documents) <= MAX_DOCUMENTS:
        raise ValueError('invalid documents')
    seen = set()
    for document in documents:
        if not isinstance(document, dict) or not isinstance(document.get('id'), str) or not document['id'] or len(document['id']) > 500 or document['id'] in seen or not isinstance(document.get('text'), str):
            raise ValueError('invalid document')
        seen.add(document['id'])
    return data['query'], documents


class Encoder:
    def __init__(self, model):
        self.model = model
        self.cache = OrderedDict()
        self.lock = threading.Lock()

    def search(self, query, documents):
        # Include content, IDs and ordering, so revised/withdrawn sources cannot reuse an older corpus.
        fingerprint = hashlib.sha256(json.dumps(documents, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        with self.lock:
            if fingerprint not in self.cache:
                passages, owners = [], []
                for document in documents:
                    tokens = self.model.tokenizer.encode(document['text'], add_special_tokens=False)
                    for start in range(0, max(1, len(tokens)), 336):
                        if len(passages) >= 12000:
                            raise ValueError('corpus too large')
                        passage = self.model.tokenizer.decode(tokens[start:start+384], skip_special_tokens=True)
                        passages.append('passage: '+passage)
                        owners.append(document['id'])
                vectors = self.model.encode(passages, normalize_embeddings=True, batch_size=32, show_progress_bar=False)
                self.cache[fingerprint] = (owners, vectors)
                if len(self.cache) > 2:
                    self.cache.popitem(last=False)
            self.cache.move_to_end(fingerprint)
            owners, vectors = self.cache[fingerprint]
            query_vector = self.model.encode(['query: '+query], normalize_embeddings=True, show_progress_bar=False)[0]
            scores = vectors @ query_vector
            best = {}
            for identifier, score in zip(owners, scores):
                best[identifier] = max(best.get(identifier, -1), min(1.0, float(score)))
            return [{'id': identifier, 'score': score} for identifier, score in sorted(best.items(), key=lambda x: (-x[1], x[0]))[:40] if score >= .75]


def handler_for(encoder, token=''):
    slots = threading.BoundedSemaphore(2)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Do not log search questions, document contents or credentials.

        def reply(self, status, payload):
            raw = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            try:
                self.wfile.write(raw)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_POST(self):
            if self.path != '/search':
                return self.reply(404, {'error': 'not found'})
            if token and not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer '+token):
                return self.reply(401, {'error': 'unauthorized'})
            if not slots.acquire(blocking=False):
                return self.reply(503, {'error': 'encoder busy'})
            try:
                self.connection.settimeout(10)
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= MAX_BYTES:
                    return self.reply(413, {'error': 'request too large'})
                query, documents = parse_payload(json.loads(self.rfile.read(size)))
                return self.reply(200, {'hits': encoder.search(query, documents)})
            except (ValueError, json.JSONDecodeError):
                return self.reply(400, {'error': 'invalid request'})
            except Exception:
                return self.reply(503, {'error': 'encoder unavailable'})
            finally:
                slots.release()
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', default='intfloat/multilingual-e5-small')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--allow-download', action='store_true')
    args = parser.parse_args()
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(args.model, device='cpu', local_files_only=not args.allow_download, trust_remote_code=False)
    token = os.environ.get('PUBLIC_SEARCH_EMBEDDING_TOKEN', '')
    if args.host not in ('127.0.0.1', 'localhost', '::1') and not token:
        parser.error('an authentication token is required for a non-loopback listener')
    ThreadingHTTPServer((args.host, args.port), handler_for(Encoder(model), token)).serve_forever()


if __name__ == '__main__':
    main()
