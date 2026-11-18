begin;
select plan(8);

select is(
  private.collector_cloud_cursor_valid(
    jsonb_build_object(
      'page','https://commission.europa.eu/node/2/rss_en',
      'offset',0,
      'frozen_urls',jsonb_build_array(
        'https://commission.europa.eu/news-and-media/news/privacy-update-2026-11-16_en'),
      'frozen_next',null
    ),'ec-news'),
  true,
  'EC News official RSS page and frozen article URLs pass the cloud cursor guard'
);

with urls as (
  select jsonb_agg('https://commission.europa.eu/news-and-media/news/'||repeat('a',220)||
    '-2026-11-'||lpad(n::text,2,'0')||'_en' order by n) value from generate_series(1,20) n
)
select is(private.collector_cloud_cursor_valid(jsonb_build_object(
  'page','https://commission.europa.eu/node/2/rss_en','offset',0,
  'frozen_urls',urls.value,'frozen_next',null),'ec-news'),
  true,'EC News large multi-item cursor passes the base and frozen validators') from urls;

select is(
  private.collector_cloud_cursor_valid(
    jsonb_build_object(
      'page','https://data.europarl.europa.eu/api/v2/documents/feed?format=application%2Fatom%2Bxml',
      'offset',0
    ),'eu-parliament'),
  true,
  'European Parliament Open Data API listing host passes the base validator'
);

select is(
  private.collector_cloud_cursor_valid(
    jsonb_build_object(
      'page','https://data.europarl.europa.eu/api/v2/documents/feed?format=application%2Fatom%2Bxml',
      'offset',0,
      'frozen_urls',jsonb_build_array(
        'https://data.europarl.europa.eu/api/v2/documents/2026-001'),
      'frozen_next',null
    ),'eu-parliament'),
  true,
  'European Parliament Open Data API frozen document URL passes both validators'
);

with urls as (
  select jsonb_agg(
    'https://commission.europa.eu/news-and-media/news/'||repeat('a',220)||
      '-2026-11-'||lpad(n::text,2,'0')||'_en' order by n) value
  from generate_series(1,20) n
), cursor as (
  select jsonb_build_object('page','https://commission.europa.eu/node/2/rss_en',
    'offset',0,'frozen_urls',urls.value,'frozen_next',null) value from urls
)
select ok(octet_length(value::text)>4000 and octet_length(value::text)<=50000,
  'multi-item official feed fixture exceeds the legacy bound but stays within the new cap')
from cursor;

with urls as (
  select jsonb_agg(
    'https://commission.europa.eu/news-and-media/news/'||repeat('a',220)||
      '-2026-11-'||lpad(n::text,2,'0')||'_en' order by n) value
  from generate_series(1,20) n
)
select is(private.collector_cloud_cursor_valid(
  jsonb_build_object('page','https://commission.europa.eu/node/2/rss_en',
    'offset',0,'frozen_urls',urls.value,'frozen_next',null),'ec-news'),
  true,'bounded multi-item EC News snapshots are accepted') from urls;

with urls as (
  select jsonb_agg('https://commission.europa.eu/news-and-media/news/'||repeat('a',100)||n::text||
    '-2026-11-'||lpad((1+((n-1)%28))::text,2,'0')||'_en' order by n) value
  from generate_series(1,101) n
)
select is(private.collector_cloud_cursor_valid(jsonb_build_object(
  'page','https://commission.europa.eu/node/2/rss_en','offset',100,
  'frozen_urls',urls.value,'frozen_next',null),'ec-news'),
  true,'official feed cursor does not impose an arbitrary 100-item ceiling') from urls;

select is(private.collector_cloud_cursor_valid(
  jsonb_build_object('page','https://evil.example/node/2/rss_en','offset',0,
    'padding',repeat('x',5000)),'ec-news'),
  false,'large official-feed cursors still reject a page outside the approved Commission domain');

select * from finish();
rollback;
