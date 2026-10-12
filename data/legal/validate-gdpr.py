"""GDPR 원판 색인·비공개 부분 초안 구조 검사. 법률 의미·권리 검수 아님."""
import argparse
import collections
import hashlib
import json
import re
from pathlib import Path
from tools.gdpr_index import extract, public_nodes

BASE = Path(__file__).resolve().parent


def check(condition, message):
    if not condition:
        raise ValueError(message)


def validate(source=None, private_draft=None):
    index = json.loads((BASE / 'sources/gdpr-index.json').read_text())
    nodes = index['nodes']
    ids = [n['node_id'] for n in nodes]
    check(len(ids) == len(set(ids)), '색인 ID 중복')
    check([n['source_order'] for n in nodes] == list(range(len(nodes))), '색인 순서 불연속')
    roots = set(index['root_ids'])
    check(all(n['parent_id'] in set(ids) | roots for n in nodes), '색인 상위 항목 누락')
    check(not index['source_body_in_repository'] and not index['translation_body_in_repository'], '공개 보류 상태 불일치')
    forbidden = {'source_text', 'korean_text', 'korean_title'}
    check(all(not forbidden.intersection(n) for n in nodes), '공개 색인에 본문 필드 포함')
    check(dict(collections.Counter(n['tag'] for n in nodes)) == index['source_counts'], '원문 구조 수 불일치')
    for tag, total in [('Article', 99), ('Recital', 173)]:
        check([n['number'] for n in nodes if n['tag'] == tag] == list(map(str, range(1, total + 1))), tag + ' 번호/순서 누락')
    check(all(re.fullmatch('[0-9a-f]{64}', n['source_sha256']) for n in nodes), '원문 해시 형식 오류')
    markdown = (BASE / 'sources/gdpr-index.md').read_text()
    check(re.findall(r'<a id="([^"]+)"></a>', markdown) == [n['node_id'] for n in nodes if n['tag'] == 'Article'], '색인 조문 앵커 불일치')
    check(not (BASE / 'translations/gdpr.json').exists() and not (BASE / 'translations/gdpr.md').exists(), '공개 보류 번역 본문 존재')
    if source:
        raw = Path(source).read_bytes()
        check(hashlib.sha256(raw).hexdigest() == index['source']['response_sha256'], '선정 원판 응답 해시 불일치')
        check(public_nodes(extract(source)) == nodes, '선정 원판과 공개 구조·번호·위치·해시 불일치')
    if private_draft:
        path = Path(private_draft)
        doc = json.loads(path.read_text())
        provisions = doc['provisions']
        check(public_nodes(provisions) == nodes, '비공개 초안의 고정 원문 메타데이터 변경')
        check(doc['translation']['status'] == 'partial_draft' and not doc['translation']['complete'], '부분 초안의 전문 완료 오표시')
        check(doc['translation']['public_release_status'] == 'withheld', '번역 본문 공개 보류 상태 불일치')
        check(all(n['human_review_status'] == 'not_started' for n in provisions), '사람 미검수 상태 변경')
        drafted = [n for n in provisions if n['translation_status'] == 'draft']
        missing = [n['node_id'] for n in provisions if n['translation_status'] != 'draft']
        check(missing == doc['coverage']['missing_node_ids'], '미작성 목록 불일치')
        check(all(n.get('korean_text') or n.get('korean_title') for n in drafted), '초안 내부 빈 번역')
        for tag, count in [('Article', 11), ('Recital', 21)]:
            check([n['number'] for n in drafted if n['tag'] == tag] == list(map(str, range(1, count + 1))), '작성된 첫 구간 번호 불일치')
        progress = index['private_draft_progress']
        check(len(drafted) == progress['drafted_nodes'] and len(missing) == progress['missing_nodes'], '공개 진행률과 비공개 초안 불일치')
        private_md = path.with_suffix('.md').read_text()
        check(re.findall(r'<a id="([^"]+)"></a>', private_md) == [n['node_id'] for n in drafted], '비공개 번역 앵커 누락·순서 오류')
        check(all((n.get('korean_text') or n.get('korean_title')) in private_md for n in drafted), '비공개 JSON/Markdown 내용 불일치')
    print(f'GDPR 구조 검사 통과: 원판 색인 {len(nodes)}노드·99조·173고려사항; '
          '비공개 부분 초안 11조/21고려사항. 공개 재배포·사람 의미 검수는 미확정.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source')
    parser.add_argument('--private-draft')
    args = parser.parse_args()
    validate(args.source, args.private_draft)
