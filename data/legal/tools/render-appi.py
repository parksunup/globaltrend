"""appi.json의 작성된 번역을 Markdown·누락 목록으로 출력한다.

python data/legal/tools/render-appi.py
원문이나 번역을 자동으로 생성하지 않는다. JSON의 korean_text/korean_title을
수정한 뒤 실행하며, 미번역 노드는 계속 누락 목록에 남는다.
"""

import collections
import json
import html
from pathlib import Path


BASE = Path(__file__).resolve().parents[1] / "translations"


def heading_coverage(nodes):
    """제목 번역과 그 장·절·관 전체의 작성 범위를 구분한다."""
    by_id = {n["node_id"]: n for n in nodes}
    result = []
    for heading in nodes:
        if heading["tag"] not in {"Chapter", "Section", "Subsection"}:
            continue
        descendants = []
        for node in nodes:
            parent = node["parent_id"]
            while parent in by_id:
                if parent == heading["node_id"]:
                    descendants.append(node)
                    break
                parent = by_id[parent]["parent_id"]
        articles = [n for n in descendants if n["tag"] == "Article"]
        result.append({
            "node_id": heading["node_id"],
            "tag": heading["tag"],
            "first_article": articles[0]["number"] if articles else None,
            "last_article": articles[-1]["number"] if articles else None,
            "total_articles": len(articles),
            "drafted_articles": sum(n["translation_status"] == "draft" for n in articles),
            "heading_translated": heading["translation_status"] == "draft",
            "all_nodes_drafted": all(n["translation_status"] == "draft"
                                     for n in [heading, *descendants]),
            "human_review_status": "not_started",
        })
    return result


def render():
    path = BASE / "appi.json"
    doc = json.loads(path.read_text())
    nodes = doc["provisions"]
    for node in nodes:
        translated = bool(node.get("korean_text") or node.get("korean_title")
                          or node.get("table_structure_ready") or node.get("source_cell_empty"))
        node["translation_status"] = "draft" if translated else "not_started"
        node["markdown_anchor"] = node["node_id"] if translated else None
    main = [n for n in nodes if n["tag"] == "Article" and n["scope"] == "main"]
    drafted = [n for n in main if n["translation_status"] == "draft"]
    if drafted != main[:len(drafted)]:
        raise ValueError("작성된 본칙 조문은 원문 첫 구간과 일치해야 합니다.")
    content_tags = {"Paragraph", "Item", "Subitem1", "Subitem2", "Subitem3"}
    for article in drafted:
        children = [n for n in nodes if n["node_id"].startswith(article["node_id"] + "-")
                    and n["tag"] in content_tags]
        if not all(n.get("korean_text") for n in children):
            raise ValueError(f"작성 조문 내부 미번역: {article['node_id']}")
        tables = [n for n in nodes if n["node_id"].startswith(article["node_id"] + "-")
                  and n["tag"] in {"Table", "TableRow", "TableColumn"}]
        if not all(n["translation_status"] == "draft" for n in tables):
            raise ValueError(f"작성 조문 내부 표 미번역: {article['node_id']}")
    source_counts = collections.Counter(n["tag"] for n in nodes)
    draft_counts = collections.Counter(n["tag"] for n in nodes if n["translation_status"] == "draft")
    missing = [n["node_id"] for n in nodes if n["translation_status"] == "not_started"]
    # 모든 노드 작성 전까지 전문 완료·전체 순서 검수 완료를 표시하지 않는다.
    doc["translation"].update(
        status="partial_draft" if missing else "full_draft",
        complete=not missing,
        translated_main_articles=len(drafted),
        main_article_coverage_percent=round(len(drafted) / len(main) * 100, 2),
        overall_coverage_percent=None,
        next_main_article=main[len(drafted)]["number"] if len(drafted) < len(main) else None,
    )
    doc["coverage"].update(source_counts=dict(source_counts), draft_counts=dict(draft_counts),
                           missing_node_ids=missing, translated_prefix_order_verified=True,
                           full_order_verified=False, semantic_completeness_verified=False,
                           heading_groups=heading_coverage(nodes))
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    version = doc["source"]["version_id"]
    last = drafted[-1]["number"] if drafted else "0"
    percent = doc["translation"]["main_article_coverage_percent"]
    lines = [
        "# 개인정보 보호에 관한 법률(APPI) — 일본 — 2026-10-01 시행 판본 — 부분 번역 초안", "",
        "- 공식 법률명: 個人情報の保護に関する法律 (平成十五年法律第五十七号)",
        "- 관할권: 일본 (`JP`)",
        "- 공식 원문: https://laws.e-gov.go.jp/document?lawid=415AC0000000057",
        f"- 공식 API·선택 판본: https://laws.e-gov.go.jp/api/2/law_data/{version}",
        f"- 판본 식별자: `{version}`; 원문 API 상태: `CurrentEnforced`.",
        "- 선택 개정 판본 시행일: 2026-10-01. 법률 최초 공포일: 2003-05-30. 법 전체의 단일 최초 시행일과 구분합니다.",
        f"- 번역 상태: 본칙 제1조~제{last}조 작성({len(drafted)}/{len(main)}개, {percent}%). "
        f"제{doc['translation']['next_main_article']}조 이후·22개 부칙 묶음·2개 별표 미번역. **전문 미완성·사람 검수 전 초안**.",
        "- 출처: e-Gov 법령검색의 위 공식 판본. 원문을 기초로 이 프로젝트가 한국어로 번역·가공한 비공식 초안이며 일본 정부가 작성한 번역이 아닙니다.",
        "- 조사일: 2026-10-06. 원문 제공 범위에는 일부 개정법 부칙의 발췌(`Extract=true`)가 포함됩니다. 각 개정법 전체를 번역한 문서는 아닙니다.",
        "- [조항별 JSON](./appi.json) · [누락·검수 목록](./appi-status.md) · [용어·이용조건·대조 메모](./appi-review-notes.md)",
        "", "## 번역 본문", "",
    ]
    for node in nodes:
        if node["translation_status"] != "draft":
            continue
        tag = node["tag"]
        if tag not in {"TableRow", "TableColumn"}:
            lines.extend([f'<a id="{node["node_id"]}"></a>', ""])
        if tag == "Table":
            lines.append('<table>')
        elif tag == "TableRow":
            lines.append('<tr>')
        elif tag == "TableColumn":
            text = html.escape(node["korean_text"] or "")
            siblings = [n for n in nodes if n["parent_id"] == node["parent_id"]]
            row_anchor = f'<a id="{node["parent_id"]}"></a>' if node == siblings[0] else ""
            anchor = f'<a id="{node["node_id"]}"></a>'
            attrs = node.get("source_attributes", {})
            borders = ";".join(f"border-{side}:" + ("none" if attrs[key] == "none" else "1px solid")
                               for side, key in [("top", "BorderTop"), ("bottom", "BorderBottom"),
                                                 ("left", "BorderLeft"), ("right", "BorderRight")]
                               if attrs.get(key) in {"none", "solid"})
            lines.append(f'<td style="{borders}">{row_anchor}{anchor}{text}</td>')
            if node == siblings[-1]:
                lines.append('</tr>')
                row = next(n for n in nodes if n["node_id"] == node["parent_id"])
                rows = [n for n in nodes if n["parent_id"] == row["parent_id"]]
                if row == rows[-1]:
                    lines.extend(['</table>', ''])
        elif tag in {"Chapter", "Section", "Subsection"}:
            level = {"Chapter": "##", "Section": "###", "Subsection": "####"}[tag]
            lines.extend([level + " " + node["korean_title"], ""])
        elif tag == "Article":
            lines.extend(["#### " + node["korean_title"], ""])
        elif tag in content_tags:
            if tag == "Paragraph":
                label = node["number"] + "항"
            elif tag == "Item":
                label = node["number"] + "호"
            else:
                label = node.get("korean_label", node["original_label"] + "목")
            lines.extend([f"**{label}.** {node['korean_text']}", ""])
        else:
            raise ValueError(f"아직 출력 형식을 구현하지 않은 단위: {tag}")
    lines.extend(["---", "", f"번역은 제{last}조까지입니다. 나머지 본칙·부칙·별표는 "
                  "[누락 목록](./appi-status.md)을 따라 같은 문서에 이어 작성합니다."])
    (BASE / "appi.md").write_text("\n".join(lines) + "\n")
    rows = ["# APPI 누락·순서·사람 검수 상태 목록", "",
            f"판본: `{version}`. 번역 초안 제1조~제{last}조; 전문 미완성. "
            "원문 전체 목록은 appi.json의 provisions 및 coverage.missing_node_ids에 있습니다. "
            "숫자 대조는 구조 검증이며 번역 정확성 검수는 아닙니다.", "",
            "| 단위 | 원문 수 | 번역 초안 수 | 남은 수 |", "| --- | ---: | ---: | ---: |"]
    for tag in ["Chapter", "Section", "Subsection", "Article", "Paragraph", "Item", "Subitem1",
                "SupplProvision", "AppdxTable", "TableRow", "TableColumn"]:
        rows.append(f"| {tag} | {source_counts[tag]} | {draft_counts[tag]} | {source_counts[tag]-draft_counts[tag]} |")
    rows.extend(["", "장·절·관의 위 숫자는 **제목을 번역한 수**이며 해당 단위 전체 작성 수가 아닙니다. "
                 "아래 표는 원문 상위 관계로 계산한 각 장의 실제 조문 범위입니다. "
                 "전체 작성도 사람 검수 완료를 뜻하지 않습니다.", "",
                 "| 장 | 원문 조문 범위 | 번역 조문 수 / 원문 수 | 장 전체 작성 상태 | 사람 검수 |",
                 "| --- | --- | ---: | --- | --- |"])
    for group in doc["coverage"]["heading_groups"]:
        if group["tag"] != "Chapter":
            continue
        heading = next(n for n in nodes if n["node_id"] == group["node_id"])
        state = "전체 초안 작성" if group["all_nodes_drafted"] else "미완성"
        rows.append(f"| {heading['original_label']} | 제{group['first_article']}조~제{group['last_article']}조 "
                    f"| {group['drafted_articles']} / {group['total_articles']} | {state} | 미착수 |")
    rows.extend(["", "## 조문별 상태", "",
                 "같은 조 번호가 반복되는 본칙(main)·부칙 묶음(suppl1~suppl22)을 구분합니다. "
                 "부칙의 가지 번호는 원문 Num 값을 유지합니다.", "",
                 "| 원문 식별자 | 조문·부칙·별표 | 번역 상태 | 사람 검수 |", "| --- | --- | --- | --- |"])
    for node in nodes:
        if node["tag"] not in {"Article", "SupplProvision", "AppdxTable"}:
            continue
        label = node["original_label"] or node["node_id"]
        if node["tag"] == "SupplProvision":
            label += " " + (node.get("amendment_law_number") or "제정법")
            if node.get("source_extract"):
                label += " (원문 제공 부칙 발췌)"
        state = f"[초안](./appi.md#{node['node_id']})" if node["translation_status"] == "draft" else "미번역"
        rows.append(f"| `{node['node_id']}` | {label} | {state} | 미착수 |")
    (BASE / "appi-status.md").write_text("\n".join(rows) + "\n")
    print(f"APPI 본칙 초안 {len(drafted)}/{len(main)}; 누락 노드 {len(missing)}개; 사람 검수 전")


if __name__ == "__main__":
    render()
