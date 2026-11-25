create function public.public_trend_topic_counts(p_topics jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with topic_terms as (
    select topic.key, array(
      select lower(regexp_replace(term, '[[:space:]]', '', 'g'))
      from jsonb_array_elements_text(topic.value) as terms(term)
    ) as normalized_terms
    from jsonb_each(p_topics) as topic
  ),
  counts as (
    select t.key, count(*) as total
    from topic_terms t
    join public.reports r on r.status = 'published'
    where exists (
      select 1 from unnest(r.topics) as tags(tag)
      where lower(regexp_replace(tag, '[[:space:]]', '', 'g')) = any(t.normalized_terms)
    )
    group by t.key
  )
  select coalesce(jsonb_object_agg(key, total), '{}'::jsonb) from counts;
$$;

revoke all on function public.public_trend_topic_counts(jsonb) from public;
grant execute on function public.public_trend_topic_counts(jsonb) to anon, authenticated;
