# 안전한 공식 자료 수집 원칙

이 수집기는 공개된 공식 자료를 정해진 간격으로 읽습니다. 사이트가 접근을 거부하거나 자료 제공 방식을 바꾸면 해당 출처를 실패로 기록하고 멈춥니다. 차단을 피해 접근을 계속하는 기능은 사용하지 않습니다.

## 요청 정책

- 모든 URL은 설정된 공식 호스트의 HTTPS 주소인지 확인합니다.
- `robots.txt`의 허용 여부를 확인합니다. 확인할 수 없거나 크롤링이 금지된 경우 본문 요청을 중단합니다.
- 같은 호스트를 향한 요청 사이에 최소 2초를 둡니다. 사이트의 `Crawl-delay`가 더 길면 더 긴 간격을 적용합니다. 조직이 여러 수집 프로세스를 동시에 실행한다면 프로세스별 간격만으로는 충분하지 않으므로 한 호스트에는 한 작업만 배정하거나, 외부 공유형 제한기를 사용해야 합니다.
- `GlobalTrendResearch/0.1` 사용자 에이전트와 수신 형식을 알리는 `Accept` 헤더를 보냅니다. 브라우저인 척하는 헤더나 위장용 `Referer`를 만들지 않습니다.
- 연결 제한시간, 응답 크기, 총 요청 수와 실행시간 상한을 둡니다. 429·403 등 거절 응답은 우회하지 않습니다. 재시도하는 경로에서는 서버가 보낸 `Retry-After`를 따르고, 재시도 횟수와 대기시간을 제한합니다. Crawlee 경로는 자동 재시도를 끄므로 오류가 나면 현재 요청을 중단합니다.
- 페이지 렌더링이 꼭 필요한 출처만 브라우저 수집 대상으로 지정합니다. 브라우저 경로도 한 번에 한 페이지를 열며, 인증 우회·프록시 회전·스텔스·CAPTCHA 해결은 하지 않습니다.

## 코드 사용

기존 수집기에서 HTTP 요청은 `scripts/collector/core.py`의 `HttpClient`, 새 Crawlee 경로는 `scripts/collector_v2/transport.py`의 `CrawleeClient`를 사용합니다. 새 출처 어댑터에서도 이 클라이언트의 `get()` 또는 `post()`를 사용해야 위 제한과 예산 계산이 유지됩니다. 원시 HTTP 라이브러리를 출처 어댑터에서 직접 호출하지 않습니다.

```python
from scripts.collector.core import HttpClient

client = HttpClient({'www.example.gov'}, interval=2)
body, final_url, content_type = client.get('https://www.example.gov/news')
```

`HttpClient`는 기본 요청 간격을 적용하고, `robots.txt`의 `Crawl-delay`가 더 길면 이를 우선합니다. `CrawleeClient`는 같은 정책을 먼저 확인한 뒤 호스트별 대기열로 요청을 간격 조정합니다. 두 구현 모두 정직한 프로젝트 식별 헤더를 적용합니다.

## 참고한 도구의 안전한 설계 요소

- [Scrapling의 정적 Fetcher 문서](https://github.com/D4Vinci/Scrapling/blob/main/docs/fetching/static.md)는 요청 헤더, 시간제한, 재시도 대기시간, 리디렉션 제한을 명시적으로 설정할 수 있게 합니다. 이 프로젝트는 그 설정 가능성만 참고하며 브라우저 위장·stealth 헤더·프록시 로테이션 기능은 사용하지 않습니다.
- [Crawl4AI의 여러 URL 수집 문서](https://docs.crawl4ai.com/advanced/multi-url-crawling/)는 병렬도, 요청 간격, 429·503·504 응답 후 대기시간을 제한하는 방식을 설명합니다. 이 프로젝트는 간격과 동시성 제한 원칙을 적용하고, 차단 후 재시도는 자동으로 하지 않습니다.
- [Scrapy AutoThrottle 문서](https://docs.scrapy.org/en/master/topics/autothrottle.html)는 응답 지연과 오류에 맞춰 호스트별 간격을 조정하고 최소 대기시간을 유지하는 원칙을 설명합니다. 현재 구현은 고정 최소 간격과 `robots.txt` 지연 준수를 우선하며, 서버 응답이 느리거나 제한 응답이 오면 더 느리게 동작하도록 개선할 수 있습니다.

이 문서는 서버 부하를 낮추는 운영 기준이지, 사이트 이용약관이나 저작권·데이터베이스권 검토를 대신하지 않습니다. 출처별 공식 RSS/API가 있으면 HTML 페이지를 긁기 전에 해당 경로를 우선 검토합니다.

