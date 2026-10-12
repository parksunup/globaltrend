"""공식 OP 관보 XHTML 구조를 읽는다. 번역문·법률 요약은 생성하지 않는다.

extract()가 반환하는 source_text는 원문 대조용이다. 공개 색인은
public_nodes()로 원문 본문과 한국어 본문을 제거하여 작성한다.
"""
import xml.etree.ElementTree as E
import re
import hashlib
import collections
from pathlib import Path


def extract(source_path):
    SRC=Path(source_path);r=E.fromstring(SRC.read_bytes());nodes=[];positions={id(e):i for i,e in enumerate(r.iter())};locations={}
    def txt(e):return re.sub(r'\s+',' ',''.join(e.itertext())).strip()
    def tag(e):return e.tag.split('}')[-1]
    def add(nid,typ,num,parent,e,text='',title='',label=''):
     assert nid not in {n['node_id'] for n in nodes},nid
     n=dict(node_id=nid,tag=typ,number=num,parent_id=parent,scope='document' if nid=='law-title' else 'recitals' if nid.startswith('recital-') else 'main' if nid.startswith('main-') else 'preface' if nid.startswith('preface-') else 'closing' if nid.startswith('closing-') else 'footnotes',source_order=len(nodes),source_locator=e.attrib.get('id'),original_label=label,source_text=text,source_title=title,source_sha256=hashlib.sha256((text or title).encode()).hexdigest(),translation_status='not_started',human_review_status='not_started',korean_text=None,korean_title=None,markdown_anchor=None)
     nodes.append(n);locations[nid]=positions[id(e)];return n

    def flow(container,parent):
     counter=collections.Counter()
     for e in container:
      t=tag(e)
      if t=='p' and e.attrib.get('class') in {'oj-ti-art','oj-ti-section-1'}:continue
      if t=='p' and e.attrib.get('class') not in {'oj-ti-art','oj-ti-section-1'}:
       counter['text']+=1;add(parent+'-t'+str(counter['text']),'Text','',parent,e,text=txt(e))
      elif t=='div' and re.fullmatch(r'\d{3}\.\d{3}',e.attrib.get('id','')):
       num=str(int(e.attrib['id'].split('.')[1]));nid=parent+'-p'+num
       direct=[x for x in e if tag(x)=='p'];intro=txt(direct[0]) if direct else ''
       intro=re.sub(r'^'+re.escape(num)+r'\.\s*','',intro)
       add(nid,'Paragraph',num,parent,e,text=intro,label=num+'.')
       children=E.Element('wrapper')
       for c in e:
        if direct and c is direct[0]:continue
        children.append(c)
       flow(children,nid)
      elif t=='table':
       for row in e.findall('./{*}tbody/{*}tr'):
        cells=row.findall('./{*}td');assert len(cells)==2,('unexpected table',parent,len(cells))
        label=txt(cells[0]);num=label.strip('()')
        if label=='—':
         counter['dash']+=1;num='';nid=parent+'-u'+str(counter['dash'])
        else:nid=parent+'-i'+num
        direct=[x for x in cells[1] if tag(x)=='p'];intro=txt(direct[0]) if direct else ''
        add(nid,'Item',num,parent,row,text=intro,label=label)
        children=E.Element('wrapper')
        for c in cells[1]:
         if direct and c is direct[0]:continue
         children.append(c)
        flow(children,nid)
      elif t=='div' and e.attrib.get('class')=='eli-title':continue
      elif t in {'col','colgroup','hr'}:continue
      else:raise ValueError((parent,t,e.attrib,txt(e)[:70]))
    for e in r.iter():
     ident=e.attrib.get('id','')
     if re.fullmatch(r'rct_\d+',ident):
      num=ident.split('_')[1];body=e.find('./{*}table/{*}tbody/{*}tr/{*}td[2]')
      add('recital-'+num,'Recital',num,'law',e,text=txt(body),label='('+num+')')
     if re.fullmatch(r'cpt_[IVX]+',ident):
      title=e.find('./{*}div[@class="eli-title"]');add('main-c'+ident[4:],'Chapter',ident[4:],'main',e,title=txt(title),label='CHAPTER '+ident[4:])
     if re.fullmatch(r'cpt_[IVX]+\.sct_\d+',ident):
      title=e.find('./{*}div[@class="eli-title"]');ch=ident.split('.')[0][4:];num=ident.rsplit('_',1)[1];add('main-c'+ch+'-s'+num,'Section',num,'main-c'+ch,e,title=txt(title),label='Section '+num)
     if re.fullmatch(r'art_\d+',ident):
      ancestors=[a for a in r.iter() if e in list(a)]
      parent=ancestors[-1].attrib.get('id','');p='main-c'+parent[4:] if parent.startswith('cpt_') and '.sct_' not in parent else 'main-c'+parent.split('.')[0][4:]+'-s'+parent.rsplit('_',1)[1]
      num=ident.split('_')[1];title=e.find('./{*}div[@class="eli-title"]');nid='main-a'+num;add(nid,'Article',num,p,e,title=txt(title),label='Article '+num);flow(e,nid)
    # Account for non-recital preface, enacting sentence, closing/signatures, and original notes.
    for rootid,prefix in [('pbl_1','preface'),('fnp_1','closing')]:
     root=next(e for e in r.iter() if e.attrib.get('id')==rootid)
     found=[]
     def pref_walk(e):
      if e.attrib.get('id','').startswith('rct_'):return
      if tag(e)=='p':
       if txt(e):found.append(e)
       return
      for c in e:pref_walk(c)
     pref_walk(root)
     for i,e in enumerate(found,1):add(prefix+'-'+str(i),'Preamble' if prefix=='preface' else 'Closing',str(i),'law',e,text=txt(e))
    root=next(e for e in r.iter() if e.attrib.get('id')=='tit_1')
    add('law-title','Title','', 'law',root,title=txt(root))
    container=next(e for e in r.iter() if e.attrib.get('class')=='eli-container')
    for i,e in enumerate([e for e in container if tag(e)=='p' and e.attrib.get('class')=='oj-note'],1):add('footnote-'+str(i),'Footnote',str(i),'law',e,text=txt(e))
    # Preserve the legal enacting phrase situated between preamble and chapters.
    enc=next(e for e in r.iter() if e.attrib.get('id')=='enc_1')
    for i,e in enumerate([e for e in enc if tag(e)=='p'],1):add('preface-enact-'+str(i),'Preamble','', 'law',e,text=txt(e))
    nodes.sort(key=lambda n:locations[n['node_id']])
    for i,n in enumerate(nodes):n['source_order']=i
    ids={n['node_id'] for n in nodes};assert all(n['parent_id'] in ids|{'main','law'} for n in nodes)
    assert [n['number'] for n in nodes if n['tag']=='Article']==list(map(str,range(1,100)))
    assert [n['number'] for n in nodes if n['tag']=='Recital']==list(map(str,range(1,174)))
    return nodes


def public_nodes(nodes):
    """구조·원문 위치·해시·제목 메타데이터만 반환한다."""
    fields = {"node_id", "tag", "number", "parent_id", "scope", "source_order",
              "source_locator", "original_label", "source_title", "source_sha256"}
    return [{key: value for key, value in node.items() if key in fields} for node in nodes]
