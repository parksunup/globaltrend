-- Run only after reviewing the nine exact PDPC media-listing referrals below.
-- They lead to other agencies, so they must not become PDPC source articles.
-- The listing dates are not asserted to be the external articles' publish dates.
begin;
do $review$
declare
  affected integer;
begin
  create temporary table pdpc_referral_review(id uuid primary key, url text not null) on commit drop;
  insert into pdpc_referral_review(id,url) values
   ('2b69472a-529b-41fc-93f5-9e277e2fb92e','https://www.csa.gov.sg/alerts-advisories/Advisories/2024/ad-2024-018'),
   ('fc0b588d-bf95-4a7e-88d7-94b2d61795de','https://www.mci.gov.sg/media-centre/speeches/minister-josephine-teo-at-personal-data-protection-seminar-2022/'),
   ('dee38efc-baa2-4f64-a085-e0581cd78bc2','https://www.mci.gov.sg/media-centre/speeches/speech-by-minister-at-the-opening-of-the-personal-data-protection-week/'),
   ('495556cc-bed5-4ac4-8fb4-b4c92ac6d7b5','https://www.mci.gov.sg/media-centre/speeches/speech-by-minister-josephine-teo-at-personal-data-protection-seminar/'),
   ('e9dfb1d9-50d3-481f-a953-2238db996a1b','https://www.mci.gov.sg/pressroom/news-and-stories/pressroom/2021/7/keynote-address-by-minister-josephine-teo-at-atxai-conference'),
   ('d8eba80a-05ac-403b-bbc8-d8e6f792b89c','https://www.mddi.gov.sg/newsroom/opening-address-by-minister-josephine-teo-at-the-personal-data-protection-week-2025/'),
   ('5bc8ed93-08ea-4a83-9220-f151efffa4f3','https://www.mddi.gov.sg/newsroom/opening-by-minister-josephine-teo-at-the-personal-data-protection-week/'),
   ('f23af4ab-d06f-40e5-9412-2dfa39e347e3','https://www.mddi.gov.sg/newsroom/opening-speech-by-minister-josephine-teo-at-singapore-data-festival-at-sands-expo-and-convention-centre/'),
   ('aeb29dee-27a0-4f03-8e02-4839dc0f8fb0','https://www.mfa.gov.sg/Newsroom/Press-Statements-Transcripts-and-Photos/2022/09/20220907jpcpsp');

  select count(*) into affected
  from public.collector_edge_backlog b join pdpc_referral_review r on r.id=b.id and r.url=b.url
  where b.source_id='ea7465ec-48fb-4b6e-8f82-7345da7e6a75'::uuid
    and not b.resolved and not b.retryable
    and b.state->>'retry_blocked_reason'='unapproved_url';
  if affected <> 9 then
    raise exception 'Expected exactly nine unchanged PDPC referral backlog rows; found %', affected;
  end if;

  update public.collector_edge_backlog b
     set resolved=true,
         state=b.state||jsonb_build_object('resolution','different_agency_source',
                'resolution_scope','PDPC listing referral, not PDPC article',
                'publication_date_verified',false),
         updated_at=now()
    from pdpc_referral_review r
   where b.id=r.id and b.url=r.url
     and b.source_id='ea7465ec-48fb-4b6e-8f82-7345da7e6a75'::uuid
     and not b.resolved and not b.retryable
     and b.state->>'retry_blocked_reason'='unapproved_url';
  get diagnostics affected=row_count;
  if affected <> 9 then raise exception 'PDPC referral update changed % rows', affected; end if;

  insert into public.collector_edge_events
    (source_id,execution_id,trigger_kind,started_at,finished_at,result)
  select 'ea7465ec-48fb-4b6e-8f82-7345da7e6a75'::uuid,
    'pdpc-external-referral-review:'||r.id::text,'manual-scope-review',now(),now(),
    jsonb_build_object('status','reviewed','saved','external_referral',
      'reason','different_agency_source','backlog_id',r.id,'url',r.url,
      'coverage_complete',false,'publication_date_verified',false)
  from pdpc_referral_review r;
end
$review$;
commit;
