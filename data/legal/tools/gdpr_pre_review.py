"""GDPR 사람 검수용 메타데이터를 준비한다. 번역/원문 본문을 출력하지 않는다.

명시적인 조문 번호 집합과 조 단위 범위만 비교한다. 항/호 참조, 외부법령
귀속, 의무/권리/예외의 의미는 이 검사로 검수 완료가 되지 않는다.
"""
import argparse
import collections
import csv
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from gdpr_index import public_nodes

BASE = Path(__file__).resolve().parents[1]
QUEUE_FIELDS = ["record_type", "record_id", "group", "official_source_url", "official_corrigendum_url",
                "official_consolidated_url", "source_version",
                "source_locator", "source_sha256", "draft_sha256", "private_document_path", "private_anchor",
                "public_body_link", "public_access_status", "mechanical_check", "human_review_status",
                "reviewer", "reviewed_at", "human_result", "question_group"]
PART = r"\d+(?:\([^()]*\))*"
ARTICLE = re.compile(
    r"\bArticles?\s+(" + PART
    + r"(?:\s*(?:,\s*(?:(?:and|or)\s+)?|(?:and|or|to)\s+|[–-]\s*)"
    + PART + r")*)", re.I,
)


def references(english, korean):
    numbers, ranges = [], []
    for match in ARTICLE.finditer(english):
        value = re.sub(r"\([^()]*\)", "", match.group(1))
        numbers.extend(map(int, re.findall(r"\d+", value)))
        ranges.extend((int(a), int(b)) for a, b in re.findall(
            r"(\d+)\s*(?:to\s+|[–-]\s*)(\d+)", value))
    ko_numbers = list(map(int, re.findall(r"제\s*(\d+)\s*조", korean)))
    ko_ranges = [(int(a), int(b)) for a, b in re.findall(
        r"제\s*(\d+)\s*조\s*(?:부터|에서|[~〜–-])\s*(?:제\s*)?(\d+)\s*조(?:까지)?",
        korean,
    )]
    return dict(english_numbers=sorted(set(numbers)), korean_numbers=sorted(set(ko_numbers)),
                english_ranges=sorted(set(ranges)), korean_ranges=sorted(set(ko_ranges)))


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def prepare(draft_path, terms_path, check_only=False):
    draft_path, terms_path = Path(draft_path).resolve(), Path(terms_path).resolve()
    repo = BASE.parents[1]
    if draft_path.is_relative_to(repo) or terms_path.is_relative_to(repo):
        raise ValueError("공개 보류 본문/용어집은 저장소 밖 입력만 사용합니다.")
    doc = json.loads(draft_path.read_text())
    index = json.loads((BASE / "sources/gdpr-index.json").read_text())
    nodes = doc["provisions"]
    assert public_nodes(nodes) == index["nodes"], "선택 판본 구조/해시 변경"
    assert doc["source"]["version_id"] == index["source"]["version_id"], "선택 판본 식별자 변경"
    assert doc["translation"]["public_release_status"] == "withheld"
    assert doc["translation"]["human_review_status"] == "not_started"
    assert all(n["human_review_status"] == "not_started" for n in nodes)
    assert all(n["translation_status"] == "draft" for n in nodes)
    assert all(digest(n["source_text"] or n["source_title"]) == n["source_sha256"] for n in nodes)
    ids = {n["node_id"] for n in nodes}
    corrections = json.loads((BASE / "sources/gdpr-correction-manifest.json").read_text())
    assert corrections["selected_version"] == doc["source"]["version_id"]
    corrected_ids = {n["node_id"] for n in corrections["corrected_nodes"]}
    consolidated_url, corrigendum_url = [s["url"] for s in doc["source"]["correction_sources"]]
    rows, no_reference, mismatches = [], [], []
    for node in nodes:
        korean = node.get("korean_text") or node.get("korean_title") or ""
        assert korean, "빈 번역"
        refs = references(node["source_text"] or node["source_title"], korean)
        matches = (refs["english_numbers"] == refs["korean_numbers"]
                   and refs["english_ranges"] == refs["korean_ranges"])
        if refs["english_numbers"] or refs["korean_numbers"]:
            rows.append(dict(node_id=node["node_id"], source_sha256=node["source_sha256"],
                             korean_sha256=digest(korean), status="match" if matches else "needs_review",
                             **refs))
        else:
            no_reference.append(node["node_id"])
        if not matches:
            mismatches.append(node["node_id"])
    terms = json.loads(terms_path.read_text())
    groups = collections.defaultdict(lambda: dict(korean=set(), node_ids=set(), spellings=set()))
    for term in terms:
        group = groups[term["english"].strip().casefold()]
        group["korean"].add(term["korean"])
        group["node_ids"].update(term.get("node_ids", []))
        group["spellings"].add(term["english"])
    invalid_term_ids = sorted({i for g in groups.values() for i in g["node_ids"] if i not in ids})
    alternatives = [dict(english=k, korean_options=sorted(g["korean"]), node_ids=sorted(g["node_ids"]))
                    for k, g in sorted(groups.items()) if len(g["korean"]) > 1]
    result = dict(audited_on_kst=datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat(),
                  source_version=doc["source"]["version_id"], method="explicit_article_numbers_and_ranges_only",
                  audited_nodes=len(nodes), reference_nodes=len(rows), no_explicit_reference_nodes=no_reference,
                  mismatched_node_ids=mismatches, references=rows, glossary_entries=len(terms),
                  glossary_unique_english_keys=len(groups), glossary_alternatives=alternatives,
                  invalid_glossary_node_ids=invalid_term_ids,
                  human_review_status="not_started", semantic_completeness_verified=False,
                  public_release_status="withheld", private_draft_sha256=digest(draft_path.read_text()),
                  scope_limits=["항·호 참조는 이 검사 대상 밖",
                                "외부법령의 조문 귀속 확인은 별도", "집합/범위 일치는 전체 의미 일치를 보장하지 않음",
                                "부정·예외·의무/재량 및 조건의 의미는 사람 검수 필요"])
    if check_only:
        return result
    queue_path = BASE / "gdpr-human-review-queue.csv"
    if queue_path.exists():
        with queue_path.open() as stream:
            previous = csv.DictReader(stream)
            if previous.fieldnames != QUEUE_FIELDS or any(
                r["human_review_status"] != "not_started" or r["reviewer"]
                or r["reviewed_at"] or r["human_result"] for r in previous
            ):
                raise ValueError("기존 사람 검수 기록 또는 다른 형식의 목록을 덮어쓰지 않습니다.")
    consolidated_path = terms_path.with_name("gdpr-terms-consolidated.json")
    if consolidated_path.exists():
        previous = json.loads(consolidated_path.read_text())
        expected_fields = {"english", "english_spellings", "korean_options", "node_ids", "human_review_status"}
        if any(set(r) != expected_fields or r.get("human_review_status") != "not_started" for r in previous):
            raise ValueError("기존 용어 검수 상태를 덮어쓰지 않습니다.")
    (BASE / "sources/gdpr-pre-review-audit.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    consolidated = [dict(english=k, english_spellings=sorted(g["spellings"]),
                         korean_options=sorted(g["korean"]), node_ids=sorted(g["node_ids"]),
                         human_review_status="not_started") for k, g in sorted(groups.items())]
    consolidated_path.write_text(
        json.dumps(consolidated, ensure_ascii=False, indent=2) + "\n")
    queue = []
    for node in nodes:
        korean = node.get("korean_text") or node.get("korean_title")
        queue.append(dict(record_type="translation", record_id=node["node_id"], group=node["scope"],
                          official_source_url=doc["source"]["original_url"],
                          official_corrigendum_url=corrigendum_url if node["node_id"] in corrected_ids else "",
                          official_consolidated_url=consolidated_url if node["scope"] == "main" else "",
                          source_version=doc["source"]["version_id"],
                          source_locator=node["source_locator"], source_sha256=node["source_sha256"],
                          draft_sha256=digest(korean), private_document_path=str(draft_path.with_suffix(".md")),
                          private_anchor=node["node_id"], public_body_link="", public_access_status="withheld",
                          mechanical_check="needs_review" if node["node_id"] in mismatches else
                          "article_reference_match" if any(r["node_id"] == node["node_id"] for r in rows) else
                          "no_explicit_article_reference", human_review_status="not_started", reviewer="",
                          reviewed_at="", human_result="", question_group="translation"))
    private_csv = draft_path.with_name("criteria-mapping.csv")
    for cell in csv.DictReader(private_csv.open()):
        if cell["jurisdiction_code"] != "EU":
            continue
        assert cell["review_status"] == "unreviewed"
        content = json.dumps({k: cell[k] for k in ["korean_summary", "major_exceptions", "article_numbers", "translation_links"]},
                             ensure_ascii=False, sort_keys=True)
        queue.append(dict(record_type="comparison", record_id=cell["cell_id"], group=cell["criterion_order"],
                          official_source_url=cell["official_source_url"], official_corrigendum_url=corrigendum_url,
                          official_consolidated_url=consolidated_url, source_version=doc["source"]["version_id"],
                          source_locator="", source_sha256="", draft_sha256=digest(content),
                          private_document_path=str(private_csv), private_anchor="", public_body_link="",
                          public_access_status="withheld", mechanical_check="separate_comparison_scope",
                          human_review_status="not_started", reviewer="", reviewed_at="", human_result="",
                          question_group="criterion-" + cell["criterion_order"]))
    assert len(queue) == len(nodes) + 17
    with queue_path.open("w") as stream:
        writer = csv.DictWriter(stream, fieldnames=QUEUE_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(queue)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--private-draft", required=True)
    parser.add_argument("--private-terms", required=True)
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    result = prepare(args.private_draft, args.private_terms, args.check_only)
    print(json.dumps({k: result[k] for k in ["audited_nodes", "reference_nodes", "mismatched_node_ids",
                     "glossary_entries", "glossary_unique_english_keys", "glossary_alternatives",
                     "invalid_glossary_node_ids", "human_review_status"]}, ensure_ascii=False))
    if result["mismatched_node_ids"] or result["invalid_glossary_node_ids"]:
        raise SystemExit(1)
