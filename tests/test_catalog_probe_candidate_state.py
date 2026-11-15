import unittest
from unittest.mock import patch

from scripts import catalog_probe


class FakeClient:
    def __init__(self, hosts):
        self.last_http_status = None
        self.last_url = None
        self.requests = 0
        self.downloaded_bytes = 0

    def get(self, url):
        self.last_http_status = 200
        self.last_url = url
        self.requests += 1
        body = b"<html><main><h1>Global CBPR update</h1></main></html>"
        self.downloaded_bytes += len(body)
        return body, url, "text/html"

    def close(self):
        pass


class CatalogProbeCandidateStateTests(unittest.TestCase):
    def test_candidate_without_date_adapter_does_not_reuse_or_require_published(self):
        source = next(
            row for row in catalog_probe.load_catalog()["sources"]
            if row["id"] == "global-cbpr"
        )
        row = {
            "url": "https://www.globalcbpr.org/observed-news-item/",
            "title": "Global CBPR update",
            "date_observations": [],
        }
        client = FakeClient(source["hosts"])
        with patch.object(catalog_probe, "CrawleeClient", return_value=client), \
             patch.object(catalog_probe, "fetch_listing", return_value=([row], None)), \
             patch.object(catalog_probe, "extract_main_text", return_value=("Official update body. " * 30, None)):
            result = catalog_probe.probe(source, {"sources": [{"source": "global-cbpr"}]})

        self.assertEqual(result["status"], "listing_and_body_extracted", result)
        self.assertIsNone(result["sample"]["publication_date_candidate"])
        self.assertEqual(client.last_url, row["url"])


if __name__ == "__main__":
    unittest.main()
