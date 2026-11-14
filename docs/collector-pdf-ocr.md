# PDF 원문과 OCR 처리

## 원칙

모든 등록 출처의 PDF는 먼저 기존 텍스트 레이어를 읽습니다. 내용이 없는 페이지는 공통 `scripts/collector/pdf_ocr.py`가 OCRmyPDF와 Tesseract로 **그 페이지만** 처리하고, pypdf가 다시 쪽별 텍스트를 추출합니다. PDF 원본은 임시 파일에서만 다루며 수정하거나 공개 저장소에 올리지 않습니다. OCR 결과는 사람 검수 전 원문 판독 보조자료입니다. OCR로 읽은 쪽 번호와 추출 방법을 원고 메타데이터에 남깁니다.

현재 Python 수집기의 직접 PDF, 공식 기사에 연결된 PDF, OECD RSS/Scrapling 경로, PDPC·CURIA 경로에 이 공통 처리를 연결했습니다. 특정 출처만 예외로 정하지 않습니다. 출처가 등록한 언어(en, es, fr, ja, nl, pt, zh)에 맞는 Tesseract 언어 팩을 선택하고 영어를 함께 사용합니다. 언어가 다르거나 OCR 결과가 짧으면 `pdf_text_missing_after_ocr` 등 실제 오류를 남기며 초안의 근거로 삼지 않습니다.

## 실행 환경

OCRmyPDF는 Python 패키지만으로 완성되지 않고 Tesseract·Ghostscript 등 시스템 프로그램이 필요합니다. GitHub의 세 Python 수집 워크플로에서 해당 오픈소스 패키지와 언어 팩을 설치하고, 이미지로만 된 PDF를 실제로 읽는 검사를 수행합니다. 이 작업은 사용자 PC가 꺼져 있어도 GitHub 호스트에서 실행됩니다. Supabase Cron이 기존 워크플로를 호출하는 구조는 유지합니다.

Supabase Edge Function의 `pdfjs-dist` 경로는 텍스트 레이어 판독만 합니다. Edge의 짧은 CPU·메모리 한도에 OCRmyPDF를 억지로 넣지 않습니다. 해당 경로의 스캔 PDF는 여전히 `pdf_text_missing_or_ocr_required`로 표시될 수 있습니다. PDPC와 CURIA는 Python Crawlee 수집 경로도 등록되어 있으므로 운영 배포 뒤 그 경로에서 동일 PDF를 재시도해 결과를 대조해야 합니다. Edge 전용 출처의 스캔 PDF는 Python OCR 경로로 넘기는 영속 작업 연결이 추가되기 전까지 완료로 표시하지 않습니다.

## 도구 선택

- **OCRmyPDF + Tesseract:** 기존 PDF의 검색 가능한 텍스트 레이어를 만드는 전용 조합입니다. 쪽 지정, 기존 텍스트 보존, 다국어 팩을 지원하여 이번 PDF 중심 수집기에 적용했습니다. 라이선스는 각각 MPL-2.0, Apache-2.0입니다.
- **PaddleOCR:** 다국어·표·복잡한 문서에 유용한 별도 후보입니다. 모델과 추론 의존성이 커서 현재의 가벼운 GitHub Python 작업에 우선 넣지 않았습니다. OCRmyPDF 실패 자료에서 표·다단 편집 문제가 실제로 반복되는지 확인한 뒤 평가합니다.
- **Tesseract.js:** PDF 입력을 직접 지원하지 않고 PDF 렌더링과 이미지 OCR 단계를 별도로 결합해야 합니다. Supabase Edge에서 현재 경로의 간단한 대체품으로 간주하지 않습니다.

참고: [OCRmyPDF 설치](https://ocrmypdf.readthedocs.io/en/latest/installation.html), [쪽별 OCR](https://ocrmypdf.readthedocs.io/en/stable/cookbook.html), [언어 팩](https://ocrmypdf.readthedocs.io/en/stable/languages.html), [Tesseract.js PDF FAQ](https://github.com/naptha/tesseract.js/blob/master/docs/faq.md), [Supabase Edge 한도](https://supabase.com/docs/guides/functions/limits).
