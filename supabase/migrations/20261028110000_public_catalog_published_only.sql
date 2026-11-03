-- A public search result requires an individually published report.
-- Korean drafts, including titles and source metadata, stay in authenticated work views.
create or replace function public.get_trend_catalog(p_offset integer default 0,p_limit integer default 200,p_item_id uuid default null)
returns table(item_id uuid,report_id uuid,title text,original_title text,official_url text,source_name text,published_date date,document_type text,editorial_status text,jurisdictions text[],topics text[])
language sql stable security definer set search_path=public,pg_temp as $$
 select i.id,r.id,r.title_ko,i.title_original,i.canonical_url,s.name,
 (i.published_at at time zone 'Asia/Seoul')::date,i.document_type,'published'::text,
 coalesce(r.jurisdictions,'{}'::text[]),coalesce(r.topics,'{}'::text[])
 from public.source_items i join public.sources s on s.id=i.source_id
 join lateral(select x.id,x.title_ko,x.jurisdictions,x.topics from public.reports x
    where x.source_item_id=i.id and x.status='published'
      and nullif(btrim(x.title_ko),'') is not null
      and nullif(btrim(x.one_line_summary_ko),'') is not null
      and nullif(btrim(x.detailed_summary_ko),'') is not null
    order by x.published_at desc nulls last,x.id limit 1) r on true
 where s.is_active and s.terms_reviewed_at is not null and (p_item_id is null or i.id=p_item_id)
 order by i.published_at desc nulls last,i.id
 limit least(greatest(p_limit,1),200) offset greatest(p_offset,0);
$$;
