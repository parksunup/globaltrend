export type AssessmentReportEntry = {
  jurisdiction: string;
  category: string;
  question: string;
  answer: string;
  summary: string;
  reason?: string;
  action?: string;
  guideSections: string[];
  guideUrl?: string;
  sourceNote: string;
  officialUrl?: string;
};

export type AssessmentReport = {
  date: string;
  jurisdictions: string[];
  questionCount: number;
  actionCount: number;
  entries: AssessmentReportEntry[];
};

const COLORS = {
  ink: "1D3028",
  body: "3C5148",
  muted: "66756D",
  green: "0F5E55",
  paleGreen: "EAF2EB",
  gold: "8A5B2C",
  paleGold: "F7F0E4",
  line: "D5DDD6",
  white: "FFFFFF",
};

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function html(value: string): string {
  return xml(value).replace(/\n/g, "<br>");
}

function run(text: string, options: { bold?: boolean; color?: string; size?: number } = {}): string {
  const properties = [
    options.bold ? "<w:b/>" : "",
    options.color ? `<w:color w:val="${options.color}"/>` : "",
    options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : "",
  ].join("");
  return `<w:r><w:rPr>${properties}<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function paragraph(text: string, options: { style?: string; bold?: boolean; color?: string; size?: number; after?: number } = {}): string {
  const pPr = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : "",
    options.after != null ? `<w:spacing w:after="${options.after}"/>` : "",
  ].join("");
  return `<w:p><w:pPr>${pPr}</w:pPr>${run(text, options)}</w:p>`;
}

function cell(text: string, width: number, shaded: string, options: { bold?: boolean; color?: string; size?: number } = {}): string {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:fill="${shaded}"/><w:vAlign w:val="center"/><w:tcMar><w:top w:w="150" w:type="dxa"/><w:start w:w="150" w:type="dxa"/><w:bottom w:w="150" w:type="dxa"/><w:end w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run(text, options)}</w:p></w:tc>`;
}

function reportTable(report: AssessmentReport): string {
  const columns = [3120, 3120, 3120];
  const borders = `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(edge => `<w:${edge} w:val="single" w:sz="5" w:color="${COLORS.line}"/>`).join("")}</w:tblBorders>`;
  const row = (values: string[], header: boolean) => `<w:tr>${values.map((value, index) => cell(value, columns[index], header ? COLORS.green : COLORS.paleGreen, { bold: header || index === 0, color: header ? COLORS.white : index === 0 ? COLORS.green : COLORS.ink, size: header ? 19 : 22 })).join("")}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/>${borders}<w:tblCellMar><w:top w:w="90" w:type="dxa"/><w:start w:w="80" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:end w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${columns.map(width => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>${row(["선택한 관할", "응답 문항", "추가 확인 항목"], true)}${row([report.jurisdictions.join(" · ") || "없음", `${report.questionCount}개`, `${report.actionCount}개`], false)}</w:tbl>`;
}

function documentXml(report: AssessmentReport): string {
  const body = [
    paragraph("GLOBALTREND  ·  기업 자가진단", { color: COLORS.green, bold: true, size: 19, after: 120 }),
    paragraph("기업 개인정보 자가진단 결과", { style: "Title", color: COLORS.ink, bold: true, size: 38, after: 100 }),
    paragraph(`작성일  ${report.date}`, { color: COLORS.muted, size: 20, after: 260 }),
    reportTable(report),
    paragraph("", { after: 100 }),
    paragraph("이 결과는 이용자가 선택한 답변을 정리한 참고자료입니다. 개인정보보호위원회나 해외 감독기구의 공식 유권해석 또는 법률 자문이 아니며, 법률상 준수 여부나 위반 여부를 판정하지 않습니다. 최신 법령·공식 지침과 실제 상황을 확인하고 판단·조치할 책임은 이용자에게 있습니다.", { color: COLORS.muted, size: 18, after: 280 }),
    ...report.entries.flatMap(entry => [
      paragraph(`${entry.jurisdiction}  ·  ${entry.category}`, { style: "Heading1", color: COLORS.ink, bold: true, size: 27, after: 80 }),
      paragraph(entry.question, { style: "Heading2", color: COLORS.ink, bold: true, size: 23, after: 100 }),
      paragraph(`내 답변  ${entry.answer}`, { bold: true, color: entry.action ? COLORS.gold : COLORS.green, size: 21, after: 100 }),
      paragraph(entry.summary, { color: COLORS.body, size: 21, after: 100 }),
      ...(entry.reason ? [paragraph(`해당 없음으로 답한 이유  ${entry.reason}`, { color: COLORS.body, size: 20, after: 90 })] : []),
      ...(entry.action ? [paragraph(`확인해 볼 내용  ${entry.action}`, { color: COLORS.body, size: 20, after: 90 })] : []),
      paragraph(`근거 메모  ${entry.sourceNote}`, { color: COLORS.muted, size: 18, after: 80 }),
      ...(entry.guideSections.length ? [paragraph(`안내서 항목  ${entry.guideSections.join(" · ")}`, { color: COLORS.green, size: 18, after: 80 })] : []),
      ...(entry.guideUrl ? [paragraph(`한국어 안내서  ${entry.guideUrl}`, { color: COLORS.green, size: 17, after: 70 })] : []),
      ...(entry.officialUrl ? [paragraph(`공식 안내  ${entry.officialUrl}`, { color: COLORS.green, size: 16, after: 0 })] : [paragraph("", { after: 100 })]),
    ]),
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr>`,
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Array<{ name: string; text: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, 33, true); lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true); local.set(name, 30); local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true); cv.setUint16(14, 33, true); cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true); cv.setUint32(42, offset, true); central.set(name, 46);
    locals.push(local); centrals.push(central); offset += local.length;
  }
  const centralBytes = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralBytes, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
  const result = new Uint8Array(offset + centralBytes + end.length);
  let cursor = 0;
  for (const part of [...locals, ...centrals, end]) { result.set(part, cursor); cursor += part.length; }
  return result;
}

export function downloadAssessmentDocx(report: AssessmentReport, filename: string): void {
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:color w:val="${COLORS.body}"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="130" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:keepNext/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/><w:keepLines/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:keepNext/><w:keepLines/></w:pPr></w:style></w:styles>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const bytes = zip([
    { name: "[Content_Types].xml", text: types }, { name: "_rels/.rels", text: rels },
    { name: "word/document.xml", text: documentXml(report) }, { name: "word/styles.xml", text: styles },
    { name: "word/_rels/document.xml.rels", text: documentRels },
  ]);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openAssessmentPdf(report: AssessmentReport): boolean {
  const target = window.open("", "_blank");
  if (!target) return false;
  target.opener = null;
  const sections = report.entries.map(entry => `<article class="entry ${entry.action ? "needs-review" : "ready"}"><p class="eyebrow">${html(entry.jurisdiction)}　·　${html(entry.category)}</p><h2>${html(entry.question)}</h2><p class="answer"><strong>내 답변</strong><span>${html(entry.answer)}</span></p><p>${html(entry.summary)}</p>${entry.reason ? `<p><strong>해당 없음으로 답한 이유</strong>　${html(entry.reason)}</p>` : ""}${entry.action ? `<p><strong>확인해 볼 내용</strong>　${html(entry.action)}</p>` : ""}<p class="source"><strong>근거 메모</strong>　${html(entry.sourceNote)}</p>${entry.guideSections.length ? `<p class="source"><strong>안내서 항목</strong>　${html(entry.guideSections.join(" · "))}${entry.guideUrl ? `<br><a href="${html(entry.guideUrl)}">한국어 안내서 열기</a>` : ""}</p>` : ""}${entry.officialUrl ? `<p class="source"><strong>공식 안내</strong>　<a href="${html(entry.officialUrl)}">${html(entry.officialUrl)}</a></p>` : ""}</article>`).join("");
  target.document.open();
  target.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>기업 개인정보 자가진단 결과</title><style>
    @page{size:A4;margin:17mm 16mm}*{box-sizing:border-box}body{margin:0;background:#f7f7f3;color:#1d3028;font-family:"Malgun Gothic","Noto Sans KR",sans-serif;font-size:11pt;line-height:1.72}.report{max-width:820px;margin:28px auto;padding:44px 52px;background:#fff;box-shadow:0 8px 36px #203b2814;border:1px solid #d5ddd6}.brand{color:#0f5e55;font-size:9pt;font-weight:700;letter-spacing:.14em}.title{margin:15px 0 4px;font-size:26pt;line-height:1.35;letter-spacing:-.05em}.date{margin:0 0 25px;color:#66756d;font-size:10pt}.summary{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #d5ddd6;margin:0 0 22px}.metric{padding:14px 16px;border-right:1px solid #d5ddd6}.metric:last-child{border:0}.metric span{display:block;color:#66756d;font-size:9pt}.metric strong{display:block;margin-top:3px;color:#0f5e55;font-size:15pt}.disclaimer{margin:0 0 28px;color:#66756d;font-size:9pt;line-height:1.75}.entry{padding:18px 0 20px;border-top:1px solid #d5ddd6;break-inside:avoid}.eyebrow{margin:0 0 5px;color:#0f5e55;font-size:9pt;font-weight:700}.entry h2{margin:0 0 10px;font-size:14pt;line-height:1.55}.answer{display:flex;gap:10px;align-items:center;margin:8px 0;color:#0f5e55}.needs-review .answer{color:#8a5b2c}.answer span{font-weight:700}.entry p{margin:5px 0}.source{color:#66756d;font-size:9pt}.source a{color:#0f5e55;overflow-wrap:anywhere}.endnote{margin-top:25px;padding-top:14px;border-top:2px solid #0f5e55;color:#66756d;font-size:9pt}@media print{body{background:#fff}.report{max-width:none;margin:0;padding:0;border:0;box-shadow:none}.entry{break-inside:avoid}a{color:#0f5e55;text-decoration:none}}
    </style></head><body><main class="report"><div class="brand">GLOBALTREND　·　기업 자가진단</div><h1 class="title">기업 개인정보 자가진단 결과</h1><p class="date">작성일　${html(report.date)}</p><section class="summary"><div class="metric"><span>선택한 관할</span><strong>${html(report.jurisdictions.join(" · ") || "없음")}</strong></div><div class="metric"><span>응답 문항</span><strong>${report.questionCount}개</strong></div><div class="metric"><span>추가 확인 항목</span><strong>${report.actionCount}개</strong></div></section><p class="disclaimer">이 결과는 이용자가 선택한 답변을 정리한 참고자료입니다. 개인정보보호위원회나 해외 감독기구의 공식 유권해석 또는 법률 자문이 아니며, 법률상 준수 여부나 위반 여부를 판정하지 않습니다. 최신 법령·공식 지침과 실제 상황을 확인하고 판단·조치할 책임은 이용자에게 있습니다.</p>${sections}<p class="endnote">응답은 사용자가 직접 선택한 내용이며, 서버에 저장하지 않고 이 문서로만 내려받았습니다.</p></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))</script></body></html>`);
  target.document.close();
  return true;
}
