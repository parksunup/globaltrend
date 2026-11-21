#!/usr/bin/env python3
"""Convert user-supplied business privacy guides into page-cited Markdown."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from pypdf import PdfReader


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9가-힣]+", "-", value).strip("-").lower()
    return re.sub(r"-+", "-", value)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", nargs="+", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("docs/business-advisor/references"))
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for source in args.pdf:
        reader = PdfReader(source)
        page_text = [(page.extract_text() or "").strip() for page in reader.pages]
        empty_pages = [str(number) for number, text in enumerate(page_text, start=1) if not text]
        output = args.output_dir / f"{slugify(source.stem)}.md"
        lines = [
            f"# {source.stem}",
            "",
            f"- 원본 파일: `{source.name}`",
            f"- 총 페이지: {len(page_text)}",
            "- 변환: pypdf 텍스트 추출. 표·도식의 시각적 구조는 원본 PDF에서 확인해야 합니다.",
            f"- 텍스트 추출이 비어 있는 페이지: {', '.join(empty_pages) if empty_pages else '없음'}",
            "",
            "> 아래 내용은 원문 PDF에서 페이지별로 추출한 텍스트입니다. 줄·표 배치가 원본과 다를 수 있으므로 인용 전 PDF 해당 쪽을 확인하세요.",
            "",
        ]
        for number, text in enumerate(page_text, start=1):
            lines.extend([f"## PDF p. {number}", "", text or "[텍스트 추출 결과 없음 — OCR/원본 페이지 확인 필요]", ""])
        output.write_text("\n".join(lines), encoding="utf-8")
        print(f"{source.name}\tpages={len(page_text)}\tchars={sum(map(len, page_text))}\tempty={len(empty_pages)}\toutput={output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
