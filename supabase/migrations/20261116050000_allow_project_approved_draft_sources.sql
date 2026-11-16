-- The project lead approved Freevacy, noyb, and overview.legal for individual
-- unpublished draft creation. This changes draft eligibility only; it does not
-- change collection access, publication, or human-review requirements.
create or replace function private.trend_draft_source_allowed(p_source_id uuid)
returns boolean
language sql
stable
parallel safe
set search_path = pg_catalog, public
as $$
  select coalesce(p_source_id = any (array[
    'a23ccfc6-4ad0-4ae7-bc85-0da35cfd2c1e'::uuid, -- edpb
    '50ec0b84-7c04-4f85-895e-50bf43219a98'::uuid, -- oecd
    '9a15e0d8-d980-41e2-8613-309a566de227'::uuid, -- curia
    '7e8b50e2-4dc6-4748-9de9-2d34c2380b47'::uuid, -- cnil
    'd7c96a28-2fca-49ad-a631-3a62cf0a03b9'::uuid, -- ico
    'b4a60458-7c61-485e-8de2-0d1126398f06'::uuid, -- dpc
    'ea7465ec-48fb-4b6e-8f82-7345da7e6a75'::uuid, -- pdpc
    '1f948872-529c-4db2-85af-4740d5f2bae3'::uuid, -- ppc
    '430bd32d-19b1-4752-8280-7b2d2acbda88'::uuid, -- ftc
    '5e5d193b-d98c-524a-9949-c35e8938caad'::uuid, -- ec
    'b064fc3c-766d-540f-9b65-3aa71e632663'::uuid, -- calprivacy
    'be57ed94-3216-5c00-bc22-63c1db22e5e0'::uuid, -- oaic
    '2cf414f7-68d3-59a0-98cb-8eaca785a9d0'::uuid, -- ca-opc
    'd4d64477-c45b-5f10-883d-374a7cd0ddfe'::uuid, -- hk-pcpd
    '0d91c2b9-8884-5533-95c2-09469c6db19b'::uuid, -- eu-parliament
    'f4dc010a-0c02-5b24-8799-bd64f20b2e25'::uuid, -- eu-council
    'd743f9ab-5194-5263-ab22-ef127336e2f2'::uuid, -- cn-cac
    'caa6854c-3e3a-5879-bbb2-fc66b648d923'::uuid, -- cn-tc260
    '5310c233-56e1-5a53-9ade-f7373140e4dc'::uuid, -- es-aepd
    '2239debc-9ce2-5cfd-99f3-c555b7cd0c94'::uuid, -- edps
    '8999005f-a0b3-4261-b073-bfce8f1834aa'::uuid, -- anpd-br
    '20f6ed2a-a84c-4260-82f4-12e8b6b969f9'::uuid, -- npc-ph
    '0db916d5-a210-4bd8-b5f3-97571fdd1e60'::uuid, -- jpdp-my
    '37bea39f-6ebe-4684-880d-19c715399c4b'::uuid, -- nist
    '4f056a27-ce76-40f8-b7ec-3eb21dc1d439'::uuid, -- iapp
    'e532813d-f9af-484b-ae30-1fa5e3cbe9cb'::uuid, -- fpf
    'e55fce7d-7b55-445d-9c8b-0841095ac7f1'::uuid, -- gpa
    'c1c51983-486c-4a6e-98ef-43eaaee88d5a'::uuid, -- g7-dpa
    'ed10f3a1-4d0d-4409-9ae4-7d320ae92abc'::uuid, -- global-cbpr
    'd5a9b352-8ebf-401a-8d83-378262cc0c12'::uuid, -- ripd
    '3fd924b0-3a38-4ba6-b9b2-5154ecca3a39'::uuid  -- iso-iec-sc27
  ]::uuid[]), false)
  or exists (
    select 1
    from public.sources s
    join public.publishers p on p.id=s.publisher_id
    where s.id=p_source_id
      and upper(p.acronym)=any(array[
        'EDPB','OECD','CJEU','CURIA','CNIL','ICO','DPC','PDPC','PPC','FTC','EC',
        'CALPRIVACY','CPPA','OAIC','CA-OPC','OPC','HK-PCPD','PCPD',
        'EU-PARLIAMENT','EP','EU-COUNCIL','CN-CAC','CAC','CN-TC260','TC260',
        'ES-AEPD','AEPD','EDPS','ANPD-BR','NPC-PH','JPDP-MY','NIST','IAPP','FPF',
        'GPA','G7-DPA','GLOBAL-CBPR','RIPD','ISO-IEC-SC27',
        'FREEVACY','NOYB','OVERVIEW-LEGAL'
      ])
  );
$$;
revoke all on function private.trend_draft_source_allowed(uuid) from public, anon, authenticated, service_role;
grant usage on schema private to service_role;
grant execute on function private.trend_draft_source_allowed(uuid) to service_role;
