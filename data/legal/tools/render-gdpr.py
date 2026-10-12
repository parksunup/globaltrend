"""비공개 GDPR 부분 초안과 본문 없는 공개 진행 색인을 출력한다. 번역 생성 없음."""
import argparse
import collections
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE.parents[1]


def render(path):
    path = Path(path).resolve()
    if path.is_relative_to(ROOT):
        raise ValueError('공개 보류 번역은 저장소 밖에서만 출력합니다.')
    doc = json.loads(path.read_text())
    nodes = doc['provisions']
    drafted = [n for n in nodes if n['translation_status'] == 'draft']
    counts = dict(collections.Counter(n['tag'] for n in nodes))
    done = dict(collections.Counter(n['tag'] for n in drafted))
    missing = [n['node_id'] for n in nodes if n['translation_status'] != 'draft']
    articles = [n for n in drafted if n['tag'] == 'Article']
    recitals = [n for n in drafted if n['tag'] == 'Recital']
    if not missing:
        raise ValueError('현재 공개 보류 부분 초안 출력기는 전문 완료 표시를 만들지 않습니다.')
    doc['translation'].update(translated_main_articles=len(articles), translated_recitals=len(recitals),
                              status='partial_draft', complete=False)
    doc['korean_title'] = f'EU GDPR 한국어 번역 부분 초안 — 제1~{len(articles)}조·고려사항1~{len(recitals)}'
    doc['coverage'].update(draft_counts=done, missing_node_ids=missing)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n')
    source = doc['source']
    lines = ['# EU GDPR 한국어 번역 부분 초안 — 사람 검수 전', '',
             '법률명: ' + doc['official_name'], '관할권: 유럽연합(EU)',
             '공식 원문: ' + source['download_url'],
             '판본: OJ L119,4.5.2016 영어 관보 원판; 최신 통합판·정오표 미확정',
             '발효: 2016-05-24 · 적용: 2018-05-25',
             f'번역 상태: 제1~{len(articles)}조·고려사항1~{len(recitals)} 부분 초안. 전문 미완성·사람 미검수·공개 재배포 보류.', '',
             f'99조 중 {len(articles)}조,173개 고려사항 중 {len(recitals)}개를 작성했습니다. '
             '나머지 조문·고려사항과 서문·말미·각주·표제는 미작성입니다. 해설·용어 검토는 별도 메모에 기록합니다.', '']
    by_id = {n['node_id']: n for n in nodes}
    for n in drafted:
        lines.append(f'<a id="{n["node_id"]}"></a>')
        if n['tag'] == 'Recital':
            lines.extend([f'## 고려사항 ({n["number"]})', '', n['korean_text'], ''])
        elif n['tag'] in {'Chapter', 'Section', 'Article'}:
            label = {'Chapter': 'CHAPTER ', 'Section': 'Section ', 'Article': '제'}[n['tag']] + n['number']
            if n['tag'] == 'Article':
                label += '조'
            depth = 2 if n['tag'] == 'Chapter' else 3
            if n['tag'] == 'Article' and by_id.get(n['parent_id'], {}).get('tag') == 'Section':
                depth = 4
            lines.extend(['#' * depth + ' ' + label + ' — ' + n['korean_title'], ''])
        else:
            lines.extend([(n['original_label'] + ' ' if n['original_label'] else '') + n['korean_text'], ''])
    path.with_suffix('.md').write_text('\n'.join(lines))
    index_path = BASE / 'sources/gdpr-index.json'
    index = json.loads(index_path.read_text())
    index['private_draft_progress'].update(main_articles=len(articles), recitals=len(recitals),
                                          drafted_nodes=len(drafted), missing_nodes=len(missing))
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n')
    public = ['# EU GDPR 원판 구조 색인 — 본문 미포함', '',
              '이 문서는 번역 전문이 아닙니다. 원문 위치·번호·목차·해시만 기록합니다. 한국어 본문은 공개 재배포 조건 미확정으로 Git에 넣지 않았습니다.', '',
              f'공식 영어 원판: [EU 출판국]({source["original_url"]}) · 발효2016-05-24 · 적용2018-05-25.',
              f'최신 통합판·정오표·사람 의미 검수는 미확정입니다. 제1~{len(articles)}조·고려사항1~{len(recitals)}의 비공개 부분 초안만 작성했습니다.', '',
              '| 구조 | 원문 수 | 비공개 초안 작성 수 |', '| --- | ---: | ---: |']
    for tag in counts:
        public.append(f'| {tag} | {counts[tag]} | {done.get(tag, 0)} |')
    public.extend(['', 'Item에는 원문 대시 항목도 포함합니다. 번호 없는 도입·후행 문장은 Text로,고려사항·서문·말미·각주는 별도로 기록합니다. 부칙·별표 노드는0개이며 각주21개는 아직 미번역입니다.', '',
                   '## 본칙 조문 색인', '', '| 조문 | 원문 제목 메타데이터 | 번역 초안·사람 검수 |', '| --- | --- | --- |'])
    for n in nodes:
        if n['tag'] == 'Article':
            state = '비공개 부분 초안·사람 미검수' if n['translation_status'] == 'draft' else '미번역·사람 미검수'
            public.append(f'| <a id="{n["node_id"]}"></a>제{n["number"]}조 | {n["source_title"]} | {state} |')
    public.extend(['', '고려사항 및 하위 구조는 [JSON 색인](./gdpr-index.json),공개 상태·남은 작업은 [GDPR 검토 메모](../translations/gdpr-review-notes.md)를 따릅니다.', ''])
    (BASE / 'sources/gdpr-index.md').write_text('\n'.join(public))
    print(f'GDPR 비공개 부분 초안: {len(articles)}/99조·{len(recitals)}/173고려사항, {len(drafted)}/{len(nodes)}노드')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--private-draft', required=True)
    render(parser.parse_args().private_draft)
