"""국가법령정보센터 본문 HTML에서 실제 선두 조문 표제를 찾는다.

조문 안의 인용 링크를 표제로 사용하지 않는다. 반환값은 번호·위치 메타데이터뿐이다.
"""

from html.parser import HTMLParser
import re


class Paragraphs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current = None
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag == "p":
            self.current = {"class": dict(attrs).get("class", ""),
                            "position": self.getpos(), "text": []}

    def handle_data(self, value):
        if self.current is not None:
            self.current["text"].append(value)

    def handle_endtag(self, tag):
        if tag == "p" and self.current is not None:
            self.rows.append(self.current)
            self.current = None


def extract(source):
    parser = Paragraphs()
    parser.feed(source)
    line_starts = [0]
    line_starts.extend(match.end() for match in re.finditer("\n", source))
    rows = []
    amendment = None
    for paragraph in parser.rows:
        text = "".join(paragraph["text"]).strip()
        classes = paragraph["class"].split()
        if "pty3" in classes:
            match = re.search(r"법률\s*제(\d+)호", text)
            amendment = match[1] if match else None
        label = re.match(r"^(제\d+조(?:의\d+)?)(?=[(（\s])", text)
        if not label:
            continue
        if "pty1_p4" in classes:
            scope = "main"
        elif ("pty3_dep1" in classes and amendment in {"21445", "19234", "20897"}
              and re.match(re.escape(label[1]) + r"\s*[(（]", text)):
            scope = "suppl-" + amendment
        else:
            continue
        line, column = paragraph["position"]
        rows.append({"article_label": label[1], "html_char_offset": line_starts[line-1] + column,
                     "line": line, "deleted_marker": bool(re.match(
                         re.escape(label[1]) + r"\s*(?:\([^)]*\)\s*)?삭제\b", text)),
                     "scope": scope})
    return rows
