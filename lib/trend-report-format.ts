/** Editorial preflight only; evidence truth and legal meaning require source review. */
export function validateTrendReport(input:unknown):string[] {
  const item=input && typeof input==='object' ? input as Record<string,unknown> : {};
  const errors:string[]=[];
  for(const [field,limit] of [['title_ko',500],['summary_ko',3000],['details_ko',20000]] as const){
    const value=item[field];
    if(typeof value!=='string' || !value.trim() || value.length>limit) errors.push(`${field}: 필수 문자열과 길이 상한 확인`);
  }
  const summary=String(item.summary_ko||'');
  const details=String(item.details_ko||'');
  if(/[\r\n]|주요 내용/.test(summary)) errors.push('summary_ko: 본문을 포함하지 않는 한 문단 핵심 요약 필요');
  const paragraphs=details.trim().split(/\r?\n\s*\r?\n/);
  if(!paragraphs.every(line=>/^- \([^)]+\) \S[^\r\n]*$/.test(line))) errors.push('details_ko: - (소제목) 설명 형식과 항목 사이 빈 줄 필요');
  if(/검토 필요|확인 필요|일반화하지|추정하지|작성하지|원문을 정확히|사람 검토|검수 대기|샘플 ID|evidence_index/.test(summary+'\n'+details)) errors.push('독자 본문의 검수 지시는 limitations 또는 검토 기록으로 이동');
  if(/(?:합니다|했습니다|됩니다|이다|했다|한다|밝혔다|설명한다|안내한다|요구한다)[.!]?\s*$/.test(summary)) errors.push('summary_ko: 발표·규정·요구·권고 등 보고서체로 종결');
  return errors;
}
