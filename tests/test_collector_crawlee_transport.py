import asyncio
import unittest
from contextlib import asynccontextmanager
from datetime import timedelta

from scripts.collector.core import FetchError, HttpClient


class Response:
    status_code=200
    headers={'Content-Type':'text/html; charset=utf-8','Content-Length':'6'}

    def __init__(self,chunks):
        self.chunks=chunks
        self.read=False

    async def read_stream(self):
        self.read=True
        for chunk in self.chunks:
            yield chunk


class StreamTransport:
    def __init__(self,response):
        self.response=response
        self.arguments=None

    @asynccontextmanager
    async def stream(self,url,**kwargs):
        self.arguments=(url,kwargs)
        yield self.response


class CrawleeTransportTests(unittest.TestCase):
    def test_pinned_crawlee_httpx_client_initializes_and_closes(self):
        client=HttpClient(['example.org'],interval=0)
        try:
            client._start_transport()
            self.assertEqual(type(client._transport).__name__,'HttpxHttpClient')
        finally:
            client.close()
        self.assertIsNone(client._transport)
        self.assertIsNone(client._loop)

    def test_crawlee_stream_preserves_method_payload_and_headers(self):
        client=HttpClient(['example.org'],interval=0)
        response=Response([b'hello ',b'world'])
        transport=StreamTransport(response)
        client._transport=transport
        result=asyncio.run(client._stream_once(
            'https://example.org/api','POST',b'{"ok":true}',{'User-Agent':'GlobalTrendResearch/0.1'}
        ))
        self.assertEqual(result,(200,response.headers,b'hello world'))
        self.assertEqual(transport.arguments[0],'https://example.org/api')
        self.assertEqual(transport.arguments[1]['method'],'POST')
        self.assertEqual(transport.arguments[1]['payload'],b'{"ok":true}')
        self.assertEqual(transport.arguments[1]['headers']['User-Agent'],'GlobalTrendResearch/0.1')
        self.assertIsNone(transport.arguments[1]['timeout'])

    def test_stream_keeps_complete_body_above_two_megabytes(self):
        client=HttpClient(['example.org'],interval=0)
        payload=b'x'*2_000_001
        client._transport=StreamTransport(Response([payload]))
        status,_,body=asyncio.run(client._stream_once('https://example.org/large','GET',None,{}))
        self.assertEqual(status,200)
        self.assertEqual(body,payload)

    def test_error_responses_do_not_read_the_body(self):
        client=HttpClient(['example.org'],interval=0)
        response=Response([b'error body'])
        response.status_code=503
        client._transport=StreamTransport(response)
        status,headers,body=asyncio.run(client._stream_once('https://example.org/unavailable','GET',None,{}))
        self.assertEqual(status,503)
        self.assertEqual(body,b'')
        self.assertFalse(response.read)


if __name__=='__main__':
    unittest.main()
