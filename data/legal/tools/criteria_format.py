"""비교 CSV 한 셀의 문서 표시 규칙. 법률 내용은 생성하지 않는다."""

import html
import json


def read_list(value):
    result = json.loads(value)
    if not isinstance(result, list) or not all(isinstance(x, str) and x for x in result):
        raise ValueError("조항·링크는 문자열 JSON 배열이어야 합니다.")
    return result


def escape(value):
    return html.escape(value, quote=False).replace("|", "&#124;").replace("\n", " ")


def render_cell(cell):
    if cell["korean_summary"] == "미검토":
        return "미검토"
    articles = read_list(cell["article_numbers"])
    links = read_list(cell["translation_links"])
    if len(articles) != len(links) or not articles:
        raise ValueError("각 관련 조항에는 하나의 읽기 링크가 필요합니다.")
    references = ", ".join(f"[{escape(label)}]({url})" for label, url in zip(articles, links))
    return "<br>".join([
        "**조항·읽기:** " + references,
        "**요약:** " + escape(cell["korean_summary"]),
        "**예외·범위:** " + escape(cell["major_exceptions"]),
        f"[공식 원문]({cell['official_source_url']})",
        "**검수:** 사람 검수 전 초안",
        "**추가 확인:** " + escape(cell["pending_reason"]),
    ])
