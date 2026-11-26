"""Reuse only a successful main-branch law-watch artifact; no legal text or credentials in artifacts."""
import argparse
import io
import json
import os
from pathlib import Path
import urllib.request
import urllib.error
import urllib.parse
import zipfile
REPO='parksunup/globaltrend'
WORKFLOW='legal-amendment-watch.yml'
MAX_ZIP=8_000_000

def request_json(path,token):
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
    with urllib.request.urlopen(req,timeout=20) as r:
        raw=r.read(2_000_001)
        if len(raw)>2_000_000:raise ValueError('github response too large')
        return json.loads(raw)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args):return None

def previous_checkpoint(token,request=request_json):
    data=request('actions/workflows/'+WORKFLOW+'/runs?branch=main&status=success&per_page=10',token)
    runs=[r for r in data['workflow_runs'] if r.get('event') in ('schedule','workflow_dispatch') and r.get('head_branch')=='main' and r.get('head_repository',{}).get('full_name')==REPO and r.get('path')=='.github/workflows/'+WORKFLOW]
    for run in runs:
        items=request('actions/runs/'+str(run['id'])+'/artifacts',token)['artifacts']
        candidates=[a for a in items if a['name']=='legal-amendment-watch' and not a['expired']]
        if candidates:return candidates[0]['id']
        raise ValueError('Latest checkpoint is missing or expired; refusing to reuse an older review queue')
    if data['workflow_runs'] and not runs:raise ValueError('Only untrusted runs were returned; refusing to reset the review queue')
    if runs:raise ValueError('Previous report expired or is missing; restore its checkpoint before starting a new baseline')
    return None

def read_checkpoint(raw):
    if len(raw)>MAX_ZIP:raise ValueError('archive too large')
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        if any(p.filename not in ('checkpoint.json','report.json') or p.file_size>4_000_000 for p in z.infolist()):raise ValueError('unexpected archive member')
        data=json.loads(z.read('checkpoint.json'))
    if data.get('schemaVersion')!=1 or not isinstance(data.get('sources'),dict) or not data['sources']:raise ValueError('invalid checkpoint')
    return data

def download(identifier,token):
    url=f'https://api.github.com/repos/{REPO}/actions/artifacts/{identifier}/zip'
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req,timeout=20) as r:raw=r.read(MAX_ZIP+1)
    except urllib.error.HTTPError as e:
        if e.code not in (301,302,303,307,308):raise
        target=e.headers['Location'];u=urllib.parse.urlsplit(target)
        if u.scheme!='https' or u.username or u.password or u.port not in (None,443) or not u.hostname or not u.hostname.endswith(('.blob.core.windows.net','.githubusercontent.com')):raise ValueError('unapproved artifact host')
        # Credentials are never sent to the signed storage host.
        with urllib.request.urlopen(target,timeout=20) as r:raw=r.read(MAX_ZIP+1)
    return read_checkpoint(raw)

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',default='.legal-watch/previous.json');args=p.parse_args()
    token=os.environ.get('GH_TOKEN','')
    if not token:raise ValueError('GH_TOKEN with Actions read is required')
    identifier=previous_checkpoint(token)
    if identifier is None:print('No previous scheduled checkpoint: initial verification is required');return
    state=download(identifier,token);out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(state,ensure_ascii=False))
if __name__=='__main__':main()
