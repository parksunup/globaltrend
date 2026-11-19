"""Read the official NPC Word attachment, without extracting or retaining its contents."""
import io
import re
import zipfile
import xml.etree.ElementTree as ET

def document_paragraphs(raw):
    try:return _document_paragraphs(raw)
    except (zipfile.BadZipFile,ET.ParseError):raise ValueError('invalid_docx_archive_or_xml') from None

def _document_paragraphs(raw):
    if len(raw)>6_000_000:raise ValueError('source_too_large')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries=archive.infolist()
        selected=[item for item in entries if item.filename=='word/document.xml']
        if len(entries)>1000 or len(selected)!=1:raise ValueError('unsafe_docx_members')
        info=selected[0]
        if info.flag_bits&1 or info.file_size>4_000_000:raise ValueError('unsafe_docx_body')
        xml=archive.read(info)
    if b'<!DOCTYPE' in xml.upper() or b'<!ENTITY' in xml.upper():raise ValueError('unsafe_docx_xml')
    root=ET.fromstring(xml);namespace='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    return '\n'.join(''.join(node.itertext()) for node in root.findall('.//'+namespace+'p'))

def article_bodies(text,number):
    # Leading labels exclude references to other articles inside a paragraph.
    matches=list(re.finditer(r'^\s*第([零〇一二三四五六七八九十百千\d]+)条(?!之)',text,re.M))
    articles={}
    for i,match in enumerate(matches):
        key='main:'+number(match[1])
        if key in articles:raise ValueError('duplicate_docx_article')
        body=text[match.start():matches[i+1].start() if i+1<len(matches) else len(text)]
        if len(re.sub(r'\s+','',body))<12:raise ValueError('incomplete_docx_article')
        articles[key]=body
    if set(articles)!={'main:'+str(i) for i in range(1,len(articles)+1)}:raise ValueError('noncontiguous_docx_articles')
    return articles
