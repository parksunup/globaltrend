"""법제 자료 구조 검사. 번역 정확성이나 법적 검수를 대신하지 않는다.

python data/legal/validate-corpus.py
python data/legal/validate-corpus.py --appi-source /path/to/e-gov-response.json
"""

import argparse
import collections
import csv
import hashlib
import json
import re
from pathlib import Path


BASE = Path(__file__).resolve().parent
ROOT = BASE.parent.parent


def check(condition, message):
    if not condition:
        raise ValueError(message)


def walk(node):
    if isinstance(node, dict):
        yield node
        for child in node.get("children", []):
            yield from walk(child)


def validate(source_path=None):
    document = json.loads((BASE / "translations/appi.json").read_text())
    nodes = document["provisions"]
    by_id = {node["node_id"]: node for node in nodes}
    check(len(by_id) == len(nodes), "APPI 원문 노드 ID 중복")
    check([node["source_order"] for node in nodes] == list(range(len(nodes))),
          "APPI 원문 노드 순서가 연속하지 않음")
    for node in nodes:
        check(node["parent_id"] in by_id or node["parent_id"] in {"main", "law"},
              f"상위 노드 누락: {node['node_id']}")
        check(re.fullmatch(r"[0-9a-f]{64}", node["source_sha256"]), "원문 노드 해시 오류")
        check(node["human_review_status"] == "not_started", "검수 미착수 상태와 불일치")

    counts = collections.Counter(node["tag"] for node in nodes)
    draft_counts = collections.Counter(node["tag"] for node in nodes
                                       if node["translation_status"] == "draft")
    check(dict(counts) == document["coverage"]["source_counts"], "APPI 원문 수 불일치")
    check(dict(draft_counts) == document["coverage"]["draft_counts"], "APPI 초안 수 불일치")
    missing = [node["node_id"] for node in nodes if node["translation_status"] == "not_started"]
    check(missing == document["coverage"]["missing_node_ids"], "미번역 노드 목록 불일치")
    check(bool(missing) and document["translation"]["complete"] is False,
          "미완료 원문을 완성된 전문으로 표시함")

    markdown = (BASE / "translations/appi.md").read_text()
    anchors = re.findall(r'<a id="([^"]+)"></a>', markdown)
    expected = [node["markdown_anchor"] for node in nodes if node["markdown_anchor"]]
    check(anchors == expected, "Markdown 앵커 누락·중복·순서 불일치")
    for node in nodes:
        if node["korean_text"]:
            check(node["korean_text"] in markdown, f"번역 본문 불일치: {node['node_id']}")
    main_articles = [node for node in nodes if node["tag"] == "Article" and node["scope"] == "main"]
    drafts = [node for node in main_articles if node["translation_status"] == "draft"]
    check(len(main_articles) == document["translation"]["total_main_articles"], "본칙 분모 불일치")
    check(len(drafts) == document["translation"]["translated_main_articles"], "번역 본칙 수 불일치")
    check(drafts == main_articles[:len(drafts)], "번역 조문이 원문 첫 구간과 불일치")
    for article in drafts:
        children = [node for node in nodes if node["node_id"].startswith(article["node_id"] + "-")
                    and node["tag"] in {"Paragraph", "Item", "Subitem1", "Subitem2", "Subitem3"}]
        check(all(node["korean_text"] for node in children), f"번역 조문 내부 누락: {article['node_id']}")

    if source_path:
        source = json.loads(Path(source_path).read_bytes())
        check(source["revision_info"]["law_revision_id"] == document["source"]["version_id"],
              "입력 원문 판본 불일치")
        canonical = json.dumps(source["law_full_text"], ensure_ascii=False, sort_keys=True,
                               separators=(",", ":")).encode()
        check(hashlib.sha256(canonical).hexdigest() == document["source"]["law_full_text_sha256"],
              "입력 원문 전체 해시 불일치")
        body = next(node for node in source["law_full_text"]["children"]
                    if isinstance(node, dict) and node["tag"] == "LawBody")
        original = [node for child in body["children"]
                    if child["tag"] in {"MainProvision", "SupplProvision", "AppdxTable"}
                    for node in walk(child)]
        original_counts = collections.Counter(node["tag"] for node in original
                                             if node["tag"] in counts)
        check(original_counts == counts, "공식 원문과 저장된 구조 수 불일치")
        for article in drafts:
            source_article = next(node for child in body["children"]
                                  if child["tag"] == "MainProvision" for node in walk(child)
                                  if node["tag"] == "Article" and node["attr"]["Num"] == article["number"])
            paragraph_ids = [node["attr"]["Num"] for node in source_article["children"]
                             if isinstance(node, dict) and node["tag"] == "Paragraph"]
            saved = [node["number"] for node in nodes
                     if node["tag"] == "Paragraph" and node["parent_id"] == article["node_id"]]
            check(paragraph_ids == saved, f"공식 원문 항 번호·순서 불일치: {article['node_id']}")

    with (BASE / "criteria-mapping.csv").open() as stream:
        cells = list(csv.DictReader(stream))
    with (BASE / "instruments.csv").open() as stream:
        laws = list(csv.DictReader(stream))
    seed = (ROOT / "supabase/migrations/20260927140000_p1_seed_sources_criteria.sql").read_text()
    criteria = [(key, label, int(order)) for key, label, order in
                re.findall(r"\('([^']+)', '([^']+)', (\d+)\)", seed)]
    check(len(criteria) == 17 and len(laws) == 7, "기존 비교 기준·법제 범위 불일치")
    pairs = [(key, law["jurisdiction_code"]) for key, _, _ in criteria for law in laws]
    check([(cell["criterion_id"], cell["jurisdiction_code"]) for cell in cells] == pairs,
          "17×7 셀 누락·중복·순서 불일치")
    comparison = (BASE / "criteria-mapping.md").read_text()
    table_rows = [line for line in comparison.splitlines() if re.match(r"\| \d+\. ", line)]
    check(len(table_rows) == 17, "Markdown 비교 행 누락")
    for (key, label, order), line in zip(criteria, table_rows):
        check(line == "| " + str(order) + ". " + label + " | " + " | ".join(["미검토"] * 7) + " |",
              "Markdown과 CSV 준비표 불일치")
        group = [cell for cell in cells if cell["criterion_id"] == key]
        check(all(cell["criterion_name"] == label and int(cell["criterion_order"]) == order
                  for cell in group), "CSV 기준명·번호 불일치")
    check(all(cell["review_status"] == "unreviewed" and cell["korean_summary"] == "미검토"
              and cell["major_exceptions"] == "미검토" and not cell["article_numbers"]
              and not cell["translation_links"] for cell in cells), "전문 미완료 상태의 비교 내용 입력")
    for cell in cells:
        law = next(law for law in laws if law["record_id"] == cell["instrument_id"])
        check(cell["official_source_url"] == law["official_url"], "셀 공식 URL과 법제 목록 불일치")
    print(f"구조 검사 통과: APPI {len(nodes)}개 원문 노드, {len(drafts)}개 본칙 초안, "
          f"{len(anchors)}개 앵커, 비교 준비 셀 {len(cells)}개. 사람 검수·전문 번역은 미완료.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--appi-source", type=Path)
    validate(parser.parse_args().appi_source)
