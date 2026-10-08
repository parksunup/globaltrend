"""criteria-mapping.csv의 법제별 분류 초안을 Markdown으로 출력한다.

법률 요약·예외·조항 선택을 생성하지 않는다. 먼저 CSV를 검토하여 수정한다.
"""

import csv
from pathlib import Path

from criteria_format import render_cell


BASE = Path(__file__).resolve().parents[1]


def render():
    with (BASE / "criteria-mapping.csv").open() as stream:
        cells = list(csv.DictReader(stream))
    with (BASE / "instruments.csv").open() as stream:
        laws = list(csv.DictReader(stream))
    criteria = [(cell["criterion_id"], cell["criterion_order"], cell["criterion_name"])
                for cell in cells if cell["jurisdiction_code"] == "KR"]
    filled = sum(cell["korean_summary"] != "미검토" for cell in cells)
    lines = [
        "# 국가·관할권별 조항 분류·요약표 — 한국·일본 비교 초안", "",
        f"초안 작성일: 2026-10-07 · 수집·이용·제공 원문 재대조일: 2026-10-08 (한국 시각). **분류 초안 {filled}/119셀 · 사람 검수 완료 0셀.** "
        "기존 17개 기준을 행으로, 7개 법제를 열로 유지합니다. 다른 해외법의 미검토 셀은 규정이 없다는 뜻이 아닙니다.", "",
        "기준 출처: [architecture.md §6.0](../../architecture.md#60-첫-법제-범위와-비교-기준) 및 기존 seed. "
        "별도 원본 첨부파일 대신 사용자의 후속 지시에 따라 저장소에 확정된 기준을 사용하며 새 기준을 만들지 않았습니다.", "",
        "한국은 국가법령정보센터의 법률 제21445호(2026-03-10 일부개정, 대표 시행일 2026-09-11) "
        "공식 한국어 원문을 읽었습니다. 한국 셀의 읽기 링크는 [조항 색인](./sources/pipa-index.md)으로 연결하며 "
        "그곳에서 공식 한국어 본문을 엽니다. 재배포 조건 미확정으로 한국 본문을 이 저장소에 넣지 않았습니다. "
        "색인은 전문이나 번역문이 아닙니다. 일부 2027-07-01 시행 규정은 해당 셀에서 현재 규정과 구분합니다.", "",
        "일본은 e-Gov의 2026-10-01 시행 고정 판본을 기준으로 "
        "[본칙·제공 부칙·별표 전체 한국어 초안](./translations/appi.md)을 읽었습니다. "
        "21개 부칙 묶음은 공식 통합 원문 자체의 발췌입니다. 한국과 일본의 선택 판본 시행일이 다르므로 "
        "동일 시점의 모든 적용 관계를 확정한 비교로 사용하지 않습니다.", "",
        "각 셀은 연결한 조항을 중심으로 자체 요약한 초안입니다. 주제별 관련 조항의 법률적 완전성, "
        "부칙 적용 관계 및 시행령·규칙·지침의 추가 근거는 사람이 확인해야 합니다. "
        "일본의 배려가 필요한 개인정보·벌금·과료를 한국 민감정보·과징금과 동일하게 취급하지 않습니다.", "",
        "| 기준 | 한국 PIPA | 일본 APPI | 중국 PIPL | EU GDPR | 영국 UK GDPR | 캘리포니아 CCPA | 싱가포르 PDPA |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for key, order, label in criteria:
        group = [next(cell for cell in cells if cell["criterion_id"] == key
                      and cell["jurisdiction_code"] == law["jurisdiction_code"]) for law in laws]
        lines.append("| " + order + ". " + label + " | " + " | ".join(render_cell(cell) for cell in group) + " |")
    lines.extend(["", "[CSV](./criteria-mapping.csv)는 각 셀을 한 행으로 기록합니다. "
                  "article_numbers와 translation_links는 순서가 대응하는 JSON 문자열 배열입니다. "
                  "review_status=unreviewed는 사람이 확인하지 않았다는 뜻이며 내용 작성 여부는 요약의 미검토 표지로 구분합니다.", "",
                  "[법제 목록](./instruments.md) · [진행표](./translation-progress.md) · "
                  "[한국·일본 추가 확인](./japan-comparison-review.md) · [이용조건·검토 메모](./review-notes.md)"])
    (BASE / "criteria-mapping.md").write_text("\n".join(lines) + "\n")
    print(f"분류 초안 {filled}/119셀; 사람 검수 완료 0셀")


if __name__ == "__main__":
    render()
