"""Adapt PR15's committed Korean HTML export to the shared reader; no translation generation."""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'public/review-drafts/gdpr.html'
INDEX = ROOT / 'data/legal/sources/gdpr-index.json'


class ExportParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.nodes = {}
        self.current = None
        self.field = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'section' and 'node' in attrs.get('class', '').split():
            if self.current:
                raise ValueError('Unexpected nested export section')
            self.current = {'id': attrs['id'], 'title': [], 'text': []}
        if self.current and tag in ('h3', 'p'):
            self.field = 'title' if tag == 'h3' else 'text'

    def handle_data(self, data):
        if self.current and self.field:
            self.current[self.field].append(data)

    def handle_endtag(self, tag):
        if tag in ('h3', 'p'):
            self.field = None
        if tag == 'section' and self.current:
            identifier = self.current['id']
            if identifier in self.nodes:
                raise ValueError('Duplicate node ' + identifier)
            self.nodes[identifier] = {k: ''.join(self.current[k]).strip() for k in ('title', 'text')}
            self.current = None


def normalize():
    parser = ExportParser()
    parser.feed(HTML.read_text(encoding='utf-8'))
    index = json.loads(INDEX.read_text(encoding='utf-8'))
    assert set(parser.nodes) == {n['node_id'] for n in index['nodes']}, 'HTML/index node mismatch'
    nodes = []
    for node in index['nodes']:
        rendered = parser.nodes[node['node_id']]
        title = rendered['title']
        if node['tag'] == 'Article':
            prefix = f"제{node['number']}조"
            if not title.startswith(prefix):
                title = prefix + ' ' + title.removeprefix('Article ' + node['number']).strip()
        elif node['tag'] == 'Recital':
            title = f"고려사항 ({node['number']})"
        nodes.append({**node, 'korean_title': title, 'korean_text': rendered['text'], 'human_review_status': 'not_started'})
    assert sum(n['tag'] == 'Article' for n in nodes) == 99
    assert sum(n['tag'] == 'Recital' for n in nodes) == 173
    source = index['source']
    return {
        'schema_version': '2.0', 'document_id': 'eu-gdpr', 'jurisdiction_code': 'EU',
        'official_name': 'Regulation (EU) 2016/679 (General Data Protection Regulation)',
        'korean_title': 'EU GDPR 한국어 번역 전문 초안',
        'source': {**source, 'original_url': source.get('download_url') or 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
                   'selected_revision_enforcement_date': '2016-05-24',
                   'scope_note': '2016년 영어 관보 원판 + 2018-05-23 영어 정오표. 2026년 전체 현행성 미확정. PR15의 공개 HTML 자체 한국어 번역 초안을 구조 변환했으며 번역문을 새로 생성하지 않았습니다. 원자료 © European Union. EU 공식 번역·승인 자료가 아닙니다.'},
        'translation': {'language': 'ko', 'status': 'full_draft', 'human_review_status': 'not_started', 'public_release_status': 'draft_for_review'},
        'export_provenance': {
            'html': 'public/review-drafts/gdpr.html', 'html_sha256': hashlib.sha256(HTML.read_bytes()).hexdigest(),
            'index': 'data/legal/sources/gdpr-index.json', 'index_sha256': hashlib.sha256(INDEX.read_bytes()).hexdigest(),
            'notice': 'public/review-drafts/publication-notice.txt',
        },
        'provisions': nodes,
    }


if __name__ == '__main__':
    target = ROOT / 'data/derived/gdpr.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(normalize(), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Normalized 1,123 GDPR nodes from the committed HTML export; human review remains not_started.')
