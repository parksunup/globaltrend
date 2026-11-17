"""Extract bounded official PDFs; no OCR, model API or retained statute body."""
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

LIMIT = 6_000_000
ORDINALS = 'FIRST SECOND THIRD FOURTH FIFTH SIXTH SEVENTH EIGHTH NINTH TENTH ELEVENTH'.split()

def pdf_text(raw):
    if not raw.startswith(b'%PDF-'): raise ValueError('not_pdf')
    if not shutil.which('pdftotext') or not shutil.which('pdfinfo'): raise ValueError('pdf_tool_unavailable')
    with tempfile.TemporaryDirectory(prefix='legal-watch-') as directory:
        source=Path(directory)/'source.pdf';target=Path(directory)/'text.txt';source.write_bytes(raw)
        info=subprocess.run(['pdfinfo',str(source)],capture_output=True,timeout=10)
        pages=re.search(rb'^Pages:\s*(\d+)\s*$',info.stdout,re.M)
        if info.returncode or not pages or not 1<=int(pages[1])<=150: raise ValueError('pdf_page_limit_or_metadata_failure')
        result=subprocess.run(['pdftotext','-layout','-f','1','-l','150',str(source),str(target)],capture_output=True,timeout=20)
        if result.returncode or not target.exists() or target.stat().st_size>LIMIT: raise ValueError('pdf_extraction_failed')
        return target.read_text(encoding='utf-8')

def singapore(text):
    version=re.search(r'version in force from (\d{2}/\d{2}/\d{4})',text)
    if not version or 'Personal Data Protection' not in text: raise ValueError('pdf_identity_not_confirmed')
    # Page numbers, repeated headers and continuation labels are not statutory changes.
    lines=[]
    for line in text.replace('\f','\n').splitlines():
        if re.match(r'^\s*(?:Informal Consolidation|Personal Data Protection\s*$|(?:\d+\s+)?Act 2012\s*(?:2020 Ed\.)?\s*$|(?:2020 Ed\.\s*)?\d*\s*$)',line): continue
        if re.match(r'^\s*(?:2020 Ed\.|(?:'+ '|'.join(ORDINALS) +r') SCHEDULE\s*[—–-]\s*continued)',line): continue
        lines.append(line)
    clean='\n'.join(lines);start=re.search(r'^\s*1\. This Act is the Personal Data Protection Act 2012\.',clean,re.M)
    schedules=list(re.finditer(r'^\s*('+ '|'.join(ORDINALS) +r') SCHEDULE\s*$',clean,re.M))
    if not start or len(schedules)!=11: raise ValueError('incomplete_pdf_structure')
    body=clean[start.start():schedules[0].start()]
    matches=list(re.finditer(r'^\s*(\d{1,3}[A-Z]?)\.(?:\s*to\s*(\d+)\.)?',body,re.M));articles={}
    for i,m in enumerate(matches):
        key='main:'+m[1].lower()+('-'+m[2] if m[2] else '')
        if key in articles: raise ValueError('duplicate_pdf_article')
        articles[key]=body[m.start():matches[i+1].start() if i+1<len(matches) else len(body)]
    if 'main:1' not in articles or 'main:68' not in articles or len(articles)<90: raise ValueError('incomplete_pdf_structure')
    for i,m in enumerate(schedules):
        if m[1]!=ORDINALS[i]: raise ValueError('schedule_order_mismatch')
        end=schedules[i+1].start() if i+1<len(schedules) else len(clean)
        part=clean[m.start():end];part=re.split(r'^\s*(?:LEGISLATIVE HISTORY|COMPARATIVE TABLE)\s*$',part,flags=re.M)[0]
        articles['schedule:'+str(i+1)]=part
    return articles,{'versionInForceFrom':version[1]},version[1]

def california(text):
    version=re.search(r'effective\s+(\d{2}/\d{2}/\d{4})',text,re.I)
    if not version or 'CALIFORNIA CONSUMER PRIVACY ACT' not in text: raise ValueError('pdf_identity_not_confirmed')
    # Skip the arrangement of sections, which contains titles but no statutory body.
    pages=text.split('\f');start=next((i for i,p in enumerate(pages) if re.match(r'^\s*1798\.100\.\s+General Duties',p) and re.search(r'^\s*\(a\)',p,re.M)),None)
    if start is None: raise ValueError('incomplete_pdf_structure')
    clean=re.sub(r'^\s*Page \d+ of \d+\s*$','','\n'.join(pages[start:]),flags=re.M)
    matches=list(re.finditer(r'^(1798\.\d+(?:\.\d+)?)\.?[ \t]*(?=[A-Z(\n])',clean,re.M));articles={}
    for i,m in enumerate(matches):
        key='main:'+m[1]
        if key in articles: raise ValueError('duplicate_pdf_article')
        articles[key]=clean[m.start():matches[i+1].start() if i+1<len(matches) else len(clean)]
    if len(articles)<46 or 'main:1798.100' not in articles or 'main:1798.199.100' not in articles: raise ValueError('incomplete_pdf_structure')
    return articles,{'effectiveDate':version[1]},version[1]
