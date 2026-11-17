"""Read-only checks of the already authorized official Korean and California hosts.

Only identifiers, edition metadata, sizes and hashes enter the report. No source
body, cookies, account credentials or publication operations are retained.
"""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess
from watch import fetch_source,SourceError,now

ROOT=Path(__file__).resolve().parents[2]

def targets():
    config=json.loads((ROOT/'config/legal-watch/sources.json').read_text())
    korea=next(s for s in config['sources'] if s['id']=='pipa')
    california={'id':'ccpa-direct','parser':'california-html','url':'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5.','allowedHosts':['leginfo.legislature.ca.gov'],'identity':['1798.100','Consumer Privacy'],'minimumArticles':30}
    # These are explicit research targets, never a replacement for the current
    # source or its operational checkpoint. Separate effective dates matter.
    planned=[]
    for name,sequence,date,law in [('pipa-planned-20270309','289415','20270309','21910'),('pipa-planned-20270701','283839','20270701','21445')]:
        source={**korea,'diagnosticExpectedEdition':{'lawNumber':law,'enforcementLabel':f'{date[:4]}. {int(date[4:6])}. {int(date[6:])}.'}}
        url=f'https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq={sequence}&efYd={date}&ancYnChk=0&chrClsCd=010202'
        planned.append((name,source,url))
    return [('pipa-current',korea,None),('pipa-selected',korea,korea['baselineUrl']),('ccpa-legislature',california,None),*planned]

def check(target,fetcher=fetch_source):
    name,source,url=target
    result={'id':name,'entryUrl':url or source['url'],'checkedAt':now(),'status':'error'}
    try:
        snapshot=fetcher(source,url)
        if source.get('diagnosticExpectedEdition') and snapshot.get('metadata')!=source['diagnosticExpectedEdition']:
            raise SourceError('planned_edition_not_confirmed')
        result.update(status='body_obtained',snapshot=snapshot)
    except SourceError as error:result['error']=str(error)
    except Exception:result['error']='unrecognized_source_format'
    return result

def run(fetcher=fetch_source):
    with ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(lambda t:check(t,fetcher),targets()))
    return {'schemaVersion':1,'generatedAt':now(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'origin':'read_only_direct_source_diagnostic','humanReviewStatus':'not_started','published':False,'results':results}

if __name__=='__main__':
    report=run();out=Path('.legal-watch/direct-diagnostic.json');out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('LEGAL_DIRECT_SOURCE_REPORT='+json.dumps(report,ensure_ascii=False,separators=(',',':')))
