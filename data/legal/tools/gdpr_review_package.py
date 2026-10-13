"""Build a local review package outside Git; never deploy or change review status."""
import argparse
import csv
import hashlib
import html
import json
import re
import shutil
import zipfile
from pathlib import Path

LEGAL = Path(__file__).resolve().parents[1]
REPO = LEGAL.parents[1]


def escaped(value):
    return html.escape(str(value or ""), quote=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(document, rows):
    nodes = document["provisions"]
    ids = {node["node_id"] for node in nodes}
    sections, navigation = [], []
    for node in nodes:
        anchor = node["node_id"]
        assert re.fullmatch(r"[a-zA-Z0-9_-]+", anchor)
        label = node.get("original_label") or node.get("number") or node["tag"]
        if node["tag"] == "Article":
            label = f'제{node["number"]}조'
        elif node["tag"] == "Recital":
            label = f'고려사항 {node["number"]}'
        title = node.get("korean_title") or ""
        body = node.get("korean_text") or ""
        heading = f"{label} {title}".strip()
        if node["tag"] in {"Article", "Chapter", "Section", "Recital"}:
            navigation.append(f'<option value="{anchor}">{escaped(heading)}</option>')
        sections.append(
            f'<section class="node {escaped(node["tag"])}" id="{anchor}">'
            f'<h3>{escaped(heading)}</h3><small>{anchor} · 사람 미검수</small>'
            f'<p>{escaped(body)}</p></section>'
        )
    comparisons = []
    references = 0
    for row in rows:
        links = []
        for label, url in zip(json.loads(row["article_numbers"]), json.loads(row["translation_links"]), strict=True):
            assert url.startswith("./gdpr.md#"), "EU translation link must target the local draft"
            anchor = url.split("#", 1)[1]
            assert anchor in ids, f"Unknown translation anchor: {anchor}"
            references += 1
            links.append(f'<a class="article-link" href="#{anchor}">{escaped(label)}</a>')
        assert row["official_source_url"].startswith("https://")
        comparisons.append(
            f'<tr id="{escaped(row["cell_id"])}"><th>{escaped(row["criterion_order"])}. '
            f'{escaped(row["criterion_name"])}</th><td>{", ".join(links)}</td>'
            f'<td>{escaped(row["korean_summary"])}</td><td>{escaped(row["major_exceptions"])}</td>'
            f'<td><a href="{escaped(row["official_source_url"])}" target="_blank" rel="noopener noreferrer">'
            '공식 원문</a><br>사람 미검수</td></tr>'
        )
    source = document["source"]
    page = """<!doctype html><html lang="ko"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>GDPR 비공개 열람용 초안</title><style>
body{font:16px/1.7 system-ui,sans-serif;max-width:1200px;margin:auto;padding:24px;color:#17212b}
header{background:#fff3cd;padding:20px;border-radius:8px}a{color:#1559a3}nav{padding:16px 0}
select,input{max-width:100%;padding:10px;margin:5px}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #cbd5df;padding:12px;vertical-align:top;min-width:130px}td{white-space:pre-wrap}
.table{overflow:auto}.node{border-bottom:1px solid #ddd;padding:12px;scroll-margin-top:20px}
.node p{white-space:pre-wrap}.node:target{background:#eaf3ff}.Article,.Chapter,.Section{background:#f2f5f8}
.Paragraph{padding-left:24px}.Item{padding-left:40px}
small{color:#52616f}h3{margin-bottom:4px}button{padding:10px}details{margin:18px 0}
</style><header><h1>GDPR 한국어 번역·비교 초안 열람</h1>
<p>이 파일은 현재 작업 내용을 로컬에서 읽는 자료입니다. 서버 업로드·공개 배포·피드백 저장 기능은 없습니다.
사람 검수는 번역 0/1123항목, EU 비교 0/17셀입니다. 공개 조건과 2026년 현행성 전체 확인은 미완료입니다.</p>
<p>판본: VERSION<br>발효: 2016-05-24 · 적용: 2018-05-25</p>
<p><a href="SOURCE" target="_blank" rel="noopener noreferrer">선택 공식 관보</a> ·
<a href="gdpr.md">번역 Markdown</a> · <a href="criteria-mapping.md">17기준×7법제 비교 Markdown</a> ·
<a href="criteria-mapping.csv">비교 CSV</a> · <a href="reference/gdpr-human-review-queue.csv">검수 대상 목록</a></p></header>
<nav><a href="#comparison">EU 17개 기준 비교</a> · <a href="#translation">번역 전체</a></nav>
<h2 id="comparison">EU 17개 기준 비교 — 별개 초안</h2>
<p>한국·일본을 포함한 전체 17×7 표는 함께 제공한 Markdown/CSV에 있습니다. EU 조문 링크를 누르면 아래 번역으로 이동합니다.</p>
<div class="table"><table><thead><tr><th>기준</th><th>관련 조항</th><th>핵심 요약</th><th>주요 예외·범위</th><th>원문·검수</th></tr></thead><tbody>COMPARISON</tbody></table></div>
<h2 id="translation">선택 보정판 전체 번역 초안</h2><p>원문의 순서대로 1123개 구조 항목을 표시합니다.
작성 완료는 의미 검수 완료가 아닙니다. 용어·판본·권리 검토 메모는 reference 폴더에 별도로 있습니다.</p>
<label>조문·고려사항 이동 <select id="jump"><option value="">선택하세요</option>NAVIGATION</select></label>
<label>본문 검색 <input id="search" placeholder="한국어 단어나 항목 ID"></label><button id="reset">검색 초기화</button>
<p id="result" aria-live="polite"></p><main>SECTIONS</main><script>
const nodes=Array.from(document.querySelectorAll('.node')); const search=document.getElementById('search');
function filter(){const term=search.value.trim().toLowerCase();let count=0;
for(const node of nodes){node.hidden=term!==''&&!node.textContent.toLowerCase().includes(term);if(!node.hidden)count++;}
document.getElementById('result').textContent=count+'개 항목 표시 / 전체 '+nodes.length+'개';}
function reveal(){search.value='';filter();const node=document.getElementById(location.hash.slice(1));if(node)node.scrollIntoView();}
search.addEventListener('input',filter);document.getElementById('reset').addEventListener('click',()=>{search.value='';filter();});
document.getElementById('jump').addEventListener('change',event=>{if(event.target.value){location.hash=event.target.value;reveal();}});
document.querySelectorAll('.article-link').forEach(link=>link.addEventListener('click',()=>{search.value='';filter();}));
window.addEventListener('hashchange',reveal);filter();if(location.hash)reveal();
</script></html>"""
    # Replace placeholders in a single pass so document text cannot become a template token.
    values = dict(VERSION=escaped(source["version_id"]), SOURCE=escaped(source["original_url"]),
                  COMPARISON="".join(comparisons), NAVIGATION="".join(navigation), SECTIONS="".join(sections))
    return re.sub(r"\b(?:VERSION|SOURCE|COMPARISON|NAVIGATION|SECTIONS)\b", lambda m: values[m[0]], page), references


def build(private, output):
    private, output = private.resolve(), output.resolve()
    assert not private.is_relative_to(REPO) and not output.is_relative_to(REPO), "본문은 저장소 밖에서만 처리합니다."
    assert not output.exists(), "기존 열람 묶음은 덮어쓰지 않습니다."
    archive = output.with_suffix(".zip")
    assert not archive.exists(), "기존 압축 파일은 덮어쓰지 않습니다."
    document = json.loads((private / "gdpr.json").read_text())
    nodes = document["provisions"]
    assert len(nodes) == 1123 and len({n["node_id"] for n in nodes}) == 1123
    assert document["translation"]["public_release_status"] == "withheld"
    assert all(n["human_review_status"] == "not_started" and n["translation_status"] == "draft" for n in nodes)
    with (private / "criteria-mapping.csv").open() as handle:
        reader = csv.DictReader(handle)
        fields, rows = reader.fieldnames, list(reader)
    assert len(rows) == 119 and len({r["cell_id"] for r in rows}) == 119
    assert all(r["review_status"] == "unreviewed" for r in rows)
    eu = sorted((r for r in rows if r["jurisdiction_code"] == "EU"), key=lambda r: int(r["criterion_order"]))
    assert [int(r["criterion_order"]) for r in eu] == list(range(1, 18))
    page, references = render(document, eu)
    output.mkdir(parents=True)
    shutil.copytree(LEGAL, output / "reference", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    for name in ("gdpr.md", "gdpr-terms.json", "gdpr-terms-consolidated.json"):
        shutil.copyfile(private / name, output / name)
    # The review JSON contains our Korean draft, structure and hashes, not English body fields.
    for node in nodes:
        node.pop("source_text", None)
        node.pop("source_title", None)
    (output / "gdpr.json").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    (output / "index.html").write_text(page)
    mapping = (private / "criteria-mapping.md").read_text().replace("../globaltrend/data/legal/", "./reference/")
    (output / "criteria-mapping.md").write_text(mapping)
    for row in rows:
        row["translation_links"] = row["translation_links"].replace("../globaltrend/data/legal/", "./reference/")
    with (output / "criteria-mapping.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fields)
        writer.writeheader()
        writer.writerows(rows)
    (output / "README.md").write_text(
        "# GDPR 비공개 검토용 보관 묶음\n\n"
        "압축을 풀고 index.html을 브라우저로 여시면 번역 전체와 EU 비교17셀을 읽을 수 있습니다. "
        "외부 프로그램·서버·로그인이 필요 없고 내용을 자동 전송하지 않습니다. 공식 원문 링크를 누르면 외부 사이트로 이동합니다.\n\n"
        "번역은2016영어관보원판+확인된2018영어정오표 선택 보정판 초안입니다. "
        "2026현행성 전체·재사용 조건 미확정, 번역1123항목/비교17셀 사람검수 미착수입니다. "
        "이 묶음은 공개 허가가 아니며 공개 저장소/웹사이트에 업로드하지 않았습니다.\n\n"
        "criteria-mapping.md/csv는 기존17기준×7법제119셀입니다. 한국·일본34셀과EU17셀은초안, "
        "다른68셀은미검토입니다. reference 폴더는 기존 법제자료 사본입니다. "
        "APPI 부칙21묶음의 원문 발췌 한계와 PIPA 공식 한국어 원문 색인을 그대로 유지했습니다.\n\n"
        "reference/gdpr-human-review-queue.csv의 작업환경 절대경로는 원래 작업 위치 기록입니다. "
        "번역은 이 폴더 gdpr.md의 동일 앵커, 비교는 criteria-mapping.csv의 동일셀ID에서 읽습니다. "
        "검수자/날짜/결과 필드는 실제 검수 뒤 해당 항목만 기록하며 지금은 모두 미착수입니다.\n"
    )
    manifest = dict(source_version=document["source"]["version_id"], translation_nodes=1123,
                    eu_comparison_cells=17, comparison_cells=119, eu_translation_links=references,
                    human_reviewed_translation_nodes=0, human_reviewed_eu_cells=0,
                    public_release_status="withheld", artifact_status="local_review_package",
                    source_inputs={name: sha(private / name) for name in ("gdpr.json", "gdpr.md", "criteria-mapping.csv")},
                    files=[dict(path=str(p.relative_to(output)), sha256=sha(p), bytes=p.stat().st_size)
                           for p in sorted(output.rglob("*")) if p.is_file()])
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(output.rglob("*")):
            if path.is_file():
                bundle.write(path, str(Path(output.name) / path.relative_to(output)))
    return {"output": str(output), "archive": str(archive), "archive_sha256": sha(archive),
            "files": len(manifest["files"]), "translation_nodes": 1123, "eu_cells": 17,
            "eu_links": references, "public_release_status": "withheld"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--private-draft-directory", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.private_draft_directory, args.output_directory), ensure_ascii=False))
