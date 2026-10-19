-- Reject empty comparison summaries and translated text before saving or publishing.
create or replace function private.validate_publication_payload(p_type text,p_payload jsonb,p_original jsonb) returns void
language plpgsql set search_path=pg_catalog,public,private as $$
declare criterion_set uuid;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>6000000 then
  raise invalid_parameter_value using message='Invalid publication payload'; end if;
 if p_type='report' then
  if jsonb_typeof(p_payload->'title_ko') is distinct from 'string' or nullif(btrim(p_payload->>'title_ko'),'') is null
   or length(p_payload->>'title_ko')>500
   or jsonb_typeof(p_payload->'one_line_summary_ko') is distinct from 'string' or nullif(btrim(p_payload->>'one_line_summary_ko'),'') is null
   or length(p_payload->>'one_line_summary_ko')>3000
   or jsonb_typeof(p_payload->'detailed_summary_ko') is distinct from 'string' or nullif(btrim(p_payload->>'detailed_summary_ko'),'') is null
   or length(p_payload->>'detailed_summary_ko')>50000
   or jsonb_typeof(p_payload->'jurisdictions') is distinct from 'array' or jsonb_typeof(p_payload->'topics') is distinct from 'array' then
   raise invalid_parameter_value using message='Title, summary, body and classification are required'; end if;
  if exists(select 1 from jsonb_array_elements((p_payload->'jurisdictions')||(p_payload->'topics')) x where jsonb_typeof(x)<>'string')
   or (p_payload ? 'key_points' and jsonb_typeof(p_payload->'key_points')<>'array') then
   raise invalid_parameter_value using message='Invalid report classification'; end if;
 elsif p_type='law' then
  if p_payload->>'recordId' is distinct from p_original->>'recordId'
   or p_payload->>'jurisdiction' is distinct from p_original->>'jurisdiction'
   or p_payload->'instrument'->>'id' is distinct from p_original->'instrument'->>'id'
   or p_payload->'instrument'->>'title' is distinct from p_original->'instrument'->>'title'
   or p_payload->'document'->>'id' is distinct from p_original->'document'->>'id'
   or p_payload->>'contentHash' is null or p_payload->>'contentHash' !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(p_payload->'cells') is distinct from 'array' then
   raise invalid_parameter_value using message='Legal package identity must remain unchanged'; end if;
  if jsonb_array_length(p_payload->'cells')<>17 or exists(select 1 from jsonb_array_elements(p_payload->'cells') c
   where c->>'jurisdiction' is distinct from p_payload->>'jurisdiction' or jsonb_typeof(c->'summary') is distinct from 'string' or nullif(btrim(c->>'summary'),'') is null) then
   raise invalid_parameter_value using message='Exactly 17 matching legal criteria are required'; end if;
  select id into criterion_set from public.criteria_sets where name='한국·일본 개인정보 보호법 비교 기준' and version=1;
  if (select count(distinct cr.id) from jsonb_array_elements(p_payload->'cells') c join public.criteria cr
   on cr.criterion_key=c->>'criterionId' and cr.criteria_set_id=criterion_set)<>17 then
   raise invalid_parameter_value using message='Exactly 17 matching legal criteria are required'; end if;
  if p_payload->'document' is distinct from 'null'::jsonb then
   if jsonb_typeof(p_payload->'document'->'sections') is distinct from 'array' then
    raise invalid_parameter_value using message='Legal sections are required'; end if;
   if exists(select 1 from jsonb_array_elements(p_payload->'document'->'sections') s
    where nullif(s->>'id','') is null or jsonb_typeof(s->'lines') is distinct from 'array') then
    raise invalid_parameter_value using message='Invalid legal section'; end if;
   if exists(select 1 from jsonb_array_elements(p_payload->'document'->'sections') s,
    jsonb_array_elements(s->'lines') l where nullif(l->>'id','') is null or jsonb_typeof(l->'text') is distinct from 'string' or nullif(btrim(l->>'text'),'') is null) then
    raise invalid_parameter_value using message='Invalid legal text'; end if;
  end if;
 else raise invalid_parameter_value using message='Unknown publication entity type'; end if;
end; $$;
