-- Synthetic test adapter only; never used by a production writer.
create function pg_temp.test_writing_review(d jsonb,job_id uuid) returns jsonb language plpgsql as $$
declare j public.draft_jobs; i public.source_items; p jsonb=public.collector_writing_policy(); r jsonb; aspect text; k text; cov jsonb='[]'; ed jsonb='{}';
begin
 select * into strict j from public.draft_jobs where id=job_id;
 select * into strict i from public.source_items where id=j.source_item_id;
 for aspect in select jsonb_array_elements_text(p->'common_aspects') loop
  cov=cov||jsonb_build_array(jsonb_build_object('aspect',aspect,'status','covered','evidence_indices',jsonb_build_array(0),'detail','합성 시험 원문의 조치와 대상 문장을 대조한 검토 기록이며 실제 기사 아님'));
 end loop;
 for k in select jsonb_array_elements_text(p->'editorial_checks') loop ed=ed||jsonb_build_object(k,'합성 시험 원문의 주체와 문장 및 수치를 대조하는 테스트 기록이며 실제 기사 아님');end loop;
 r=jsonb_build_object('policy_id',p->>'policy_id','instruction_hashes',p->'instruction_hashes',
  'source_revision_id',j.source_item_revision_id,'input_hash',j.input_hash,
  'draft_hash',encode(extensions.digest(convert_to((d->>'title_ko')||E'\n'||(d->>'summary_ko')||E'\n'||(d->>'details_ko'),'UTF8'),'sha256'),'hex'),
  'article_type','brief_notice','source_reading',jsonb_build_object('url',i.canonical_url,'read_scope','full_official_body','locator','합성 시험 원문 본문 첫 문장부터 마지막 문장까지','reviewed_at',now()),
  'supplements','[]'::jsonb,'coverage',cov,'editorial_review',ed,
  'brevity_reason','합성 원문에 확인 가능한 사실이 제한돼 해당 사실만 원고로 구성한 시험 자료이며 실제 기사 아님');
 return d||jsonb_build_object('writing_review',r);
end; $$;
