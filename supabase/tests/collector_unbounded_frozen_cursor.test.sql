select plan(3);
select lives_ok(
  $$select private.collector_cloud_frozen_cursor_valid(
    jsonb_build_object(
      'frozen_urls',jsonb_build_array('https://ec.europa.eu/commission/presscorner/detail/en/ip_26_2274'),
      'frozen_next',null,
      'offset',repeat('9',1000)::numeric,
      'page','https://ec.europa.eu/commission/presscorner/api/search?language=en'
    ),'ec')$$,
  'a very large numeric cursor offset is rejected without throwing a cast error'
);
select is(
  private.collector_cloud_frozen_cursor_valid(
    jsonb_build_object(
      'frozen_urls',jsonb_build_array('https://ec.europa.eu/commission/presscorner/detail/en/ip_26_2274'),
      'frozen_next',null,
      'offset',repeat('9',1000)::numeric,
      'page','https://ec.europa.eu/commission/presscorner/api/search?language=en'
    ),'ec'),false,
  'an overflowing cursor offset is invalid'
);
select is(
  private.collector_cloud_frozen_cursor_valid(
    jsonb_build_object(
      'frozen_urls',jsonb_build_array('https://ec.europa.eu/commission/presscorner/detail/en/ip_26_2274'),
      'frozen_next',null,
      'offset',1,
      'page','https://ec.europa.eu/commission/presscorner/api/search?language=en'
    ),'ec'),true,
  'an in-range cursor offset stays valid'
);
select * from finish();
