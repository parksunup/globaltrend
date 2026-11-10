import asyncio
import unittest
from unittest.mock import patch

from scripts.collector.core import HttpClient, FetchError


class FakeCrawleeHttpClient(HttpClient):
    """Exercise the collector's redirect policy without network access."""

    def __init__(self, responses, hosts=('ico.org.uk',)):
        super().__init__(hosts, interval=0)
        self.responses=responses
        self.paths=[]

    def _run_async(self,coroutine):
        return asyncio.run(coroutine)

    async def _stream_once(self,url,method,payload,headers):
        self.paths.append(url)
        status,headers,body=self.responses[url]
        return status,headers,body


class RedirectTests(unittest.TestCase):
    def client(self, disallow=False):
        robots='User-agent: *\nDisallow: /blocked\n' if disallow else 'User-agent: *\nAllow: /\n'
        return FakeCrawleeHttpClient({
            'https://ico.org.uk/robots.txt':(200,{'Content-Type':'text/plain'},robots.encode()),
            'https://ico.org.uk/allowed':(302,{'Location':'/blocked'},b''),
            'https://ico.org.uk/http-redirect':(301,{'Location':'http://ico.org.uk/upgraded'},b''),
            'https://ico.org.uk/blocked':(200,{'Content-Type':'text/plain'},b'The redirected body'),
            'https://ico.org.uk/upgraded':(200,{'Content-Type':'text/plain'},b'upgraded'),
        })

    def test_redirect_cannot_fetch_robots_disallowed_path(self):
        client=self.client(disallow=True)
        with patch('scripts.collector.core.time.sleep'):
            with self.assertRaisesRegex(FetchError,'robots_disallowed'):
                client.get('https://ico.org.uk/allowed')
        self.assertEqual(client.paths,['https://ico.org.uk/robots.txt','https://ico.org.uk/allowed'])
        client.close()

    def test_redirect_counts_every_http_request(self):
        client=self.client()
        with patch('scripts.collector.core.time.sleep'):
            body,final,ctype=client.get('https://ico.org.uk/allowed')
        self.assertEqual(body,b'The redirected body')
        self.assertEqual(final,'https://ico.org.uk/blocked')
        self.assertEqual(ctype,'text/plain')
        self.assertEqual(client.budget['requests'],len(client.paths))
        client.close()

    def test_same_host_http_redirect_is_upgraded_before_fetch(self):
        client=self.client()
        with patch('scripts.collector.core.time.sleep'):
            body,final,_=client.get('https://ico.org.uk/http-redirect')
        self.assertEqual(body,b'upgraded')
        self.assertEqual(final,'https://ico.org.uk/upgraded')
        self.assertNotIn('http://ico.org.uk/upgraded',client.paths)
        client.close()

    def test_http_redirect_to_unapproved_host_is_rejected(self):
        client=FakeCrawleeHttpClient({'https://ico.org.uk/allowed':(302,{'Location':'https://other.example/path'},b'')})
        with patch('scripts.collector.core.time.sleep'):
            with self.assertRaisesRegex(FetchError,'network_or_redirect_failure:ValueError'):
                client.request('https://ico.org.uk/allowed')
        client.close()

    def test_request_count_is_not_clipped_by_a_fixed_budget(self):
        responses={f'https://ico.org.uk/page-{i}':(200,{'Content-Type':'text/plain'},b'ok') for i in range(13)}
        client=FakeCrawleeHttpClient(responses)
        with patch('scripts.collector.core.time.sleep'):
            for i in range(13): client.request(f'https://ico.org.uk/page-{i}')
        self.assertEqual(client.requests,13)
        self.assertEqual(len(client.paths),13)
        client.close()

    def test_retry_after_is_honored_for_server_errors(self):
        client=FakeCrawleeHttpClient({'https://ico.org.uk/page':(503,{'Retry-After':'3'},b'')})
        # Change the response only after the first streamed attempt.
        attempts=[]
        async def retry_response(url,method,payload,headers):
            attempts.append(url)
            if len(attempts)==1: return 503,{'Retry-After':'3'},b''
            return 200,{'Content-Type':'text/plain'},b'ok'
        client._stream_once=retry_response
        sleeps=[]
        with patch('scripts.collector.core.time.sleep',side_effect=lambda amount:sleeps.append(amount)):
            body,_,_=client.request('https://ico.org.uk/page')
        self.assertEqual(body,b'ok')
        self.assertEqual(len(attempts),2)
        self.assertIn(3,sleeps)
        client.close()


if __name__=='__main__':
    unittest.main()
