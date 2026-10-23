"""Existing-project management operations. Never logs tokens, secret values or bodies.

Use only SUPABASE_ACCESS_TOKEN against api.supabase.com. Data keys never enter
this client. Activation is separate from migration and function deployment.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
BASE = 'https://api.supabase.com/v1/projects/emlgwhkgaihhrirhdpnp'
MIGRATIONS = [ROOT / 'supabase/migrations' / name for name in [
    '20261021130000_collector_edge_runtime.sql',
    '20261021131500_collector_edge_backlog.sql',
    '20261021133000_collector_backlog_dedup.sql',
]]

def request(path, data=None, content_type='application/json', method=None):
    token = os.environ.get('SUPABASE_ACCESS_TOKEN')
    if not token:
        raise RuntimeError('SUPABASE_ACCESS_TOKEN_missing')
    req = urllib.request.Request(BASE + path, data=data, method=method,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': content_type})
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            body = response.read()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as error:
        # Error bodies may echo secret arguments; only the status is safe by default.
        raise RuntimeError('management_http_' + str(error.code)) from None

def sql(query, read_only=False):
    return request('/database/query', json.dumps({'query': query, 'read_only': read_only}).encode())

def pending_migrations():
    installed = {r['version'] for r in sql('select version from supabase_migrations.schema_migrations')}
    return [p for p in MIGRATIONS if p.name.split('_')[0] not in installed]

def deploy():
    if pending_migrations():
        raise RuntimeError('runtime_migrations_required_before_deployment')
    subprocess.run(['git', 'diff', '--exit-code', 'HEAD', '--', 'supabase/functions/trend-collector'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    boundary = 'globaltrend_' + uuid.uuid4().hex
    parts = []
    def add(name, body, filename=None):
        head = f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"'
        if filename:
            head += f'; filename="{filename}"'
        parts.extend([(head + '\r\n\r\n').encode(), body, b'\r\n'])
    add('metadata', json.dumps({'entrypoint_path': 'index.ts', 'verify_jwt': False, 'name': 'trend-collector'}).encode())
    folder = ROOT / 'supabase/functions/trend-collector'
    for name in ['index.ts', 'runtime.ts', 'adapter.ts', 'http.ts', 'registry.json', 'deno.json']:
        add('file', (folder / name).read_bytes(), name)
    parts.append(f'--{boundary}--\r\n'.encode())
    result = request('/functions/deploy?slug=trend-collector', b''.join(parts), 'multipart/form-data; boundary=' + boundary)
    print(json.dumps({k: result.get(k) for k in ['id', 'slug', 'status', 'version']}))

def configure():
    # Generate inside Vault. Plaintext never appears in SQL, a file or output.
    sql("""do $$ begin
      if not exists(select 1 from vault.secrets where name='trend_collector_invocation_key') then
       perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'trend_collector_invocation_key');
      end if; end; $$;""")
    key = sql("select decrypted_secret from vault.decrypted_secrets where name='trend_collector_invocation_key'")[0]['decrypted_secret']
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    request('/secrets', json.dumps([{'name': 'TREND_COLLECTOR_INVOCATION_KEY', 'value': key},
        {'name': 'TREND_COLLECTOR_GIT_SHA', 'value': sha}]).encode())
    # sha is a verified hexadecimal Git object ID, not arbitrary SQL input.
    if len(sha) != 40 or any(c not in '0123456789abcdef' for c in sha):
        raise RuntimeError('invalid_git_sha')
    sql("update public.collector_edge_control set git_sha='" + sha + "',updated_at=now() where singleton")
    print('invocation credential configured in Edge secrets and Vault; value withheld')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['check-sql', 'apply', 'deploy', 'configure', 'activate', 'pause'])
    action = parser.parse_args().action
    if action == 'check-sql':
        pending = pending_migrations()
        setup = '\n'.join(p.read_text() for p in pending)
        reset = "update public.collector_edge_control set enabled=false; delete from pgmq.q_trend_collect; delete from public.collector_edge_backlog; update public.collector_edge_sources set queued=false,state='{}';"
        print(json.dumps(sql('begin;\n' + setup + reset + '\n' + (ROOT / 'scripts/collector/check_edge_runtime.sql').read_text() + '\nrollback;')))
    elif action == 'apply':
        for path in pending_migrations():
            version, name = path.stem.split('_', 1)
            sql('begin;\n'+path.read_text()+"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('"+version+"','"+name+"',array[]::text[]);\ncommit;")
            print('applied ' + path.name)
        print('runtime migrations current; activation remains a separate action')
    elif action == 'deploy':
        deploy()
    elif action == 'configure':
        configure()
    elif action == 'activate':
        print(json.dumps(sql("""begin;
          update public.collector_edge_control set enabled=true,updated_at=now() where singleton;
          select cron.schedule('trend-collector-daily','17 22 * * *',$q$select public.collector_edge_enqueue('daily-cron');$q$);
          select cron.schedule('trend-collector-consumer','* * * * *',$q$select public.collector_edge_tick();$q$);
          commit;""")))
    elif action == 'pause':
        sql('update public.collector_edge_control set enabled=false,updated_at=now() where singleton')
        print('runtime paused; durable queue/state preserved')
