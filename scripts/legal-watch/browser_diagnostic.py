"""Ordinary anonymous browser check on the authorized legislature host.

TLS verification stays enabled. No CAPTCHA interaction, stealth settings or
cookies are exported. Requests to hosts outside the existing scope are blocked.
"""
import json
import os
from pathlib import Path
import shutil
import urllib.parse
from watch import now,parse_source,SourceError

URL='https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5.'

def run():
    result={'schemaVersion':1,'checkedAt':now(),'url':URL,'tlsVerificationEnabled':True,'status':'browser_unavailable'}
    binary=next((shutil.which(name) for name in ['google-chrome','google-chrome-stable','chromium','chromium-browser'] if shutil.which(name)),None)
    if not binary:return result
    from playwright.sync_api import sync_playwright
    proxy=None;inherited=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    if inherited:
        url=urllib.parse.urlsplit(inherited);proxy={'server':url.scheme+'://'+url.hostname+(':'+str(url.port) if url.port else '')}
        if url.username:proxy['username']=urllib.parse.unquote(url.username)
        if url.password:proxy['password']=urllib.parse.unquote(url.password)
    blocked=set()
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path=binary,headless=True,proxy=proxy)
        context=browser.new_context(ignore_https_errors=False)
        def route(request):
            url=urllib.parse.urlsplit(request.request.url)
            if url.scheme=='https' and url.hostname=='leginfo.legislature.ca.gov' and url.port in (None,443):request.continue_()
            else:blocked.add(url.hostname or url.scheme);request.abort()
        context.route('**/*',route);page=context.new_page()
        try:
            response=page.goto(URL,wait_until='domcontentloaded',timeout=25000);page.wait_for_timeout(8000)
            result.update(initialHttpStatus=response.status if response else None,title=page.title()[:200])
            source={'parser':'california-html','identity':['1798.100','Consumer Privacy'],'minimumArticles':30}
            try:
                result['snapshot']=parse_source(source,page.content().encode());result['snapshot']['acquiredUrl']=URL;result['status']='body_obtained'
            except SourceError as error:result.update(status='body_not_confirmed',error=str(error))
        except Exception as error:result.update(status='browser_error',error='certificate_trust_error' if 'ERR_CERT' in str(error) else type(error).__name__)
        finally:browser.close()
    result['blockedOutOfScopeHosts']=sorted(blocked)
    return result

if __name__=='__main__':
    report=run();target=Path('.legal-watch/browser-diagnostic.json');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('LEGAL_BROWSER_SOURCE_REPORT='+json.dumps(report,ensure_ascii=False,separators=(',',':')))
