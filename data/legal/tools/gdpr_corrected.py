"""2016 원판에 공식 2018 영어 정오표를 합성한다. 원문·번역 생성 없음."""
import copy
import hashlib
import re
import xml.etree.ElementTree as ET

TARGETS = [(37, 1, 'c'), (41, 3, None), (41, 5, None), (42, 7, None),
           (43, 3, None), (43, 6, None), (57, 1, 'p'), (64, 1, 'c'),
           (64, 6, None), (64, 7, None), (64, 8, None), (65, 1, 'a'),
           (69, 2, None), (70, 1, 'l'), (70, 1, 'o'), (70, 1, 'p')]


def text(element):
    return re.sub(r'\s+', ' ', ''.join(element.itertext())).strip()


def apply_correction(nodes, consolidated, corrigendum):
    result = copy.deepcopy(nodes)
    by_id = {n['node_id']: n for n in result}
    root = ET.parse(consolidated).getroot()
    articles = {e.attrib['id']: e for e in root.iter()
                if re.fullmatch(r'art_\d+', e.attrib.get('id', ''))}
    if list(articles) != ['art_' + str(i) for i in range(1, 100)]:
        raise ValueError('공식 영어 통합본문 99조 순서 불일치')
    replacements = {}
    for number, paragraph, item in TARGETS:
        element = next(e for e in articles['art_' + str(number)].iter()
                       if e.attrib.get('class') == 'norm'
                       and any(c.attrib.get('class') == 'no-parag'
                               and text(c).rstrip('.') == str(paragraph) for c in e))
        content = next(c for c in element if c.attrib.get('class') == 'norm inline-element')
        node_id = f'main-a{number}-p{paragraph}'
        if item:
            grid = next(e for e in content.iter()
                        if e.attrib.get('class') == 'grid-container grid-list'
                        and any(c.attrib.get('class') == 'list grid-list-column-1'
                                and text(c) == f'({item})' for c in e))
            content = next(c for c in grid if c.attrib.get('class') == 'grid-list-column-2')
            node_id += '-i' + item
        # Consolidated ►C1/◄ are editorial change markers, not statutory words.
        replacements[node_id] = re.sub(r'\s+', ' ', re.sub(r'[▼►](?:C\d+|B)|◄', '', text(content))).strip()
    corr = text(ET.parse(corrigendum).getroot())
    passage = corr[corr.index('On page 14'):corr.index('On page 55')]
    quotes = re.findall(r'(?:for|read): ‘(.*?)’[,\.]', passage)
    if len(quotes) != 2:
        raise ValueError('고려사항71 공식 정오표 for/read 짝 불일치')
    before, after = [re.sub(r'^\(71\) …\s*', '', q) for q in quotes]
    source = by_id['recital-71']['source_text']
    if source.count(before) != 1:
        raise ValueError('고려사항71 정정 전 구절 원판 불일치')
    replacements['recital-71'] = source.replace(before, after)
    for node_id, value in replacements.items():
        node = by_id[node_id]
        if value == node['source_text'] or any(n['parent_id'] == node_id for n in result):
            raise ValueError('정정 대상 변경/하위 본문 구조 재확인 필요: ' + node_id)
        node['source_text'] = value
        node['source_sha256'] = hashlib.sha256(value.encode()).hexdigest()
    return result
