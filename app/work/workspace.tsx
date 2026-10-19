"use client";

import {useEffect, useMemo, useRef, useState, type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {
  canSelectForPublication, filterWorkspaceItems, publicationBlockers, safeWorkspaceHref,
  workspaceItemKey, workspaceKindLabels, workspacePage, workspaceStatusLabels, workspaceTarget,
  type WorkspaceActionResult, type WorkspaceCommand, type WorkspaceFilters, type WorkspaceItem,
  type WorkspaceKind, type WorkspaceOperation, type WorkspaceTarget,
} from "../../lib/workspace-model";
import {jurisdictionName} from "../../lib/jurisdictions";
import styles from "./workspace.module.css";

type Props = {
  items: WorkspaceItem[];
  canEdit: boolean;
  canPublish: boolean;
  readOnly?: boolean;
  initialKind?: "all" | WorkspaceKind;
  executeAction: (command: WorkspaceCommand) => Promise<WorkspaceActionResult>;
};
type DetailTab = "preview" | "edit" | "history";
const actionNames: Record<WorkspaceOperation,string> = {publish:"공개",request_publication:"공개 요청",unpublish:"공개 취소",trash:"휴지통 이동",restore:"복원",save_trend:"수정 저장"};
const csv = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map(part=>part.trim()).filter(Boolean);

export default function Workspace({items,canEdit,canPublish,readOnly=false,initialKind="all",executeAction}:Props) {
  const router=useRouter();
  const inFlight=useRef(false);
  const dialog=useRef<HTMLElement|null>(null);
  const [filters,setFilters]=useState<WorkspaceFilters>({query:"",kind:initialKind,status:"all"});
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<string[]>([]);
  const selectedRevisions=useRef(new Map<string,string>());
  const [selectionNotice,setSelectionNotice]=useState("");
  const [openKey,setOpenKey]=useState<string|null>(null);
  const [tab,setTab]=useState<DetailTab>("preview");
  const [pending,setPending]=useState<WorkspaceOperation|null>(null);
  const [last,setLast]=useState<{operation:WorkspaceOperation; result:WorkspaceActionResult; targets:WorkspaceTarget[]; items:WorkspaceItem[]}|null>(null);
  const [confirmation,setConfirmation]=useState<{operation:"trash"|"unpublish";item:WorkspaceItem}|null>(null);
  useEffect(()=>{
    if(!confirmation)return;
    const previous=document.activeElement as HTMLElement|null;
    const buttons=()=>Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
    buttons()[0]?.focus();
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setConfirmation(null);return;}
      if(event.key!=='Tab')return;
      const targets=buttons(),first=targets[0],last=targets[targets.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',handleKey);
    return()=>{document.removeEventListener('keydown',handleKey);previous?.focus();};
  },[confirmation]);
  useEffect(()=>{
    const changed=selected.filter(key=>!items.some(item=>workspaceItemKey(item)===key&&item.revision===selectedRevisions.current.get(key)));
    if(!changed.length)return;
    setSelected(current=>current.filter(key=>!changed.includes(key)));
    changed.forEach(key=>selectedRevisions.current.delete(key));
    setSelectionNotice(`선택한 뒤 내용이 바뀌거나 목록에서 사라진 ${changed.length}건의 선택을 해제했습니다. 최신 내용을 보고 다시 선택해 주세요.`);
  },[items,selected]);
  const filtered=useMemo(()=>filterWorkspaceItems(items,filters),[items,filters]);
  const paged=workspacePage(filtered,page);
  const selectionOperation:WorkspaceOperation=filters.status==="trashed"?"restore":canPublish?"publish":"request_publication";
  const selectable=filtered.filter(item=>filters.status==="trashed"?item.status==="trashed":canSelectForPublication(item));
  const pageSelectable=paged.items.filter(item=>selectable.some(candidate=>workspaceItemKey(candidate)===workspaceItemKey(item)));
  const selectedItems=selectable.filter(item=>selected.includes(workspaceItemKey(item)));
  const selectedCount=selectedItems.length;
  const disabled=readOnly||!canEdit||!!pending;
  const allPageSelected=pageSelectable.length>0&&pageSelectable.every(item=>selected.includes(workspaceItemKey(item)));
  const visibleFailures=new Map(last?.result.failures.map(failure=>[failure.key,failure.message])??[]);

  function changeFilters(next:Partial<WorkspaceFilters>) {setFilters(current=>({...current,...next}));setPage(1);setSelected([]);selectedRevisions.current.clear();setSelectionNotice("");}
  function toggle(item:WorkspaceItem,checked:boolean) {
    const key=workspaceItemKey(item);if(checked)selectedRevisions.current.set(key,item.revision);else selectedRevisions.current.delete(key);setSelected(current=>checked?[...new Set([...current,key])]:current.filter(value=>value!==key));
  }
  function selectMany(targets:WorkspaceItem[],checked:boolean) {
    const keys=targets.map(workspaceItemKey);
    targets.forEach(item=>{if(checked)selectedRevisions.current.set(workspaceItemKey(item),item.revision);else selectedRevisions.current.delete(workspaceItemKey(item));});
    setSelected(current=>checked?[...new Set([...current,...keys])]:current.filter(key=>!keys.includes(key)));
    setSelectionNotice("");
  }
  async function run(operation:WorkspaceOperation,targets:WorkspaceItem[],draft?:WorkspaceCommand["draft"],frozenTargets?:WorkspaceTarget[]) {
    if(inFlight.current||disabled||!targets.length)return;
    const requested=frozenTargets??targets.map(workspaceTarget);
    inFlight.current=true;setPending(operation);setConfirmation(null);
    const result:WorkspaceActionResult={succeeded:[],failures:[]};
    const targetItems=new Map(targets.map(item=>[workspaceItemKey(item),item]));
    const groupCounts=new Map<string,number>();
    if(operation==="publish")for(const target of requested){
      const group=target.kind==="law"?targetItems.get(workspaceItemKey(target))?.publicationGroup:undefined;
      if(group)groupCounts.set(group,(groupCounts.get(group)??0)+1);
    }
    const actionable=requested.filter(target=>{
      const group=target.kind==="law"?targetItems.get(workspaceItemKey(target))?.publicationGroup:undefined;
      if(operation==="publish"&&group&&(groupCounts.get(group)??0)>1){
        result.failures.push({key:workspaceItemKey(target),message:"같은 법률의 여러 판본이 선택됐습니다. 공개할 판본 하나만 선택해 주세요."});return false;
      }
      return true;
    });
    try {
      // The server accepts at most 100 records per call; all-result selection is processed in batches.
      for(let offset=0;offset<actionable.length;offset+=100) {
        const batch=actionable.slice(offset,offset+100);
        try {
          const response=await executeAction({operation,targets:batch,...(draft?{draft}:{})});
          result.succeeded.push(...response.succeeded);result.failures.push(...response.failures);
        } catch {
          result.failures.push(...actionable.slice(offset).map(target=>({key:workspaceItemKey(target),message:"연결을 확인하지 못했습니다. 화면을 새로고침해 상태를 확인한 뒤 다시 시도해 주세요."})));
          break;
        }
      }
      setLast({operation,result,targets:requested,items:targets});
      setSelected(current=>current.filter(key=>!result.succeeded.includes(key)));
      result.succeeded.forEach(key=>selectedRevisions.current.delete(key));
      // A failed save preserves the form's entered values, even if another version now exists.
      if(operation!=="save_trend"||result.succeeded.length>0)router.refresh();
    } finally {inFlight.current=false;setPending(null);}
  }
  function open(item:WorkspaceItem) {const key=workspaceItemKey(item);setOpenKey(openKey===key?null:key);setTab("preview");}
  function edit(item:WorkspaceItem,event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const data=new FormData(event.currentTarget);
    void run("save_trend",[item],{title:String(data.get("title")??"").trim(),summary:String(data.get("summary")??"").trim(),body:String(data.get("body")??""),jurisdictions:csv(data.get("jurisdictions")),topics:csv(data.get("topics"))});
  }
  const retryItems=(last?.result.failures??[]).flatMap(failure=>{const item=items.find(item=>workspaceItemKey(item)===failure.key)??last?.items.find(item=>workspaceItemKey(item)===failure.key);return item?[item]:[];});
  function retryFailed() {
    if(!last)return;
    const failures=new Set(last.result.failures.map(failure=>failure.key));
    void run(last.operation,retryItems,undefined,last.targets.filter(target=>failures.has(workspaceItemKey(target))));
  }
  const canRetry=last&&!["save_trend","trash","unpublish"].includes(last.operation)&&retryItems.length>0;

  return <section className={styles.workspace} aria-labelledby="workspace-heading">
    <header className={styles.heading}><div><p className={styles.eyebrow}>GlobalTrend 작업 공간</p><h1 id="workspace-heading">자료 관리</h1><p>자료를 골라 공개하고, 필요한 내용만 고치세요.</p></div><a className={styles.siteLink} href="/public" target="_blank" rel="noopener noreferrer">공개 사이트 보기 ↗</a></header>
    {readOnly&&<p className={styles.readOnly}>화면 확인용입니다. 이 화면에서는 실제 자료를 저장하거나 공개하지 않습니다.</p>}
    {last&&<section className={last.result.failures.length?styles.resultWarning:styles.result} aria-live="polite" aria-label="작업 결과">
      <strong>{actionNames[last.operation]} 완료 {last.result.succeeded.length}건{last.result.failures.length>0?` · 처리하지 못한 자료 ${last.result.failures.length}건`:""}</strong>
      {last.operation==="unpublish"&&last.result.succeeded.length>0&&<p>공개 사이트에서 내렸습니다. 자료와 수정 기록은 작업 공간에 남아 있습니다.</p>}
      {last.operation==="save_trend"&&last.result.succeeded.length>0&&<p>수정본을 저장했습니다. 공개 중인 내용은 ‘수정본 공개’를 눌러야 바뀝니다.</p>}
      {last.result.failures.length>0&&<ul>{last.result.failures.map(failure=><li key={failure.key}><strong>{(items.find(item=>workspaceItemKey(item)===failure.key)??last.items.find(item=>workspaceItemKey(item)===failure.key))?.title??"선택한 자료"}</strong>: {failure.message}</li>)}</ul>}
      {canRetry&&<button type="button" className={styles.secondary} disabled={disabled} onClick={retryFailed}>실패한 {retryItems.length}건 다시 시도</button>}
      <button className={styles.dismiss} type="button" onClick={()=>setLast(null)} aria-label="작업 결과 닫기">닫기</button>
    </section>}
    {selectionNotice&&<p className={styles.readOnly} role="status">{selectionNotice}</p>}
    <div className={styles.filters}>
      <div className={styles.kinds} role="group" aria-label="자료 종류">{(["all","trend","law"] as const).map(kind=><button key={kind} type="button" aria-pressed={filters.kind===kind} onClick={()=>changeFilters({kind})}>{kind==="all"?"전체 자료":workspaceKindLabels[kind]}</button>)}</div>
      <label className={styles.search}><span>자료 검색</span><input type="search" value={filters.query} onChange={event=>changeFilters({query:event.target.value})} placeholder="제목, 국가, 본문으로 검색"/></label>
      <label className={styles.statusFilter}><span>상태</span><select value={filters.status} onChange={event=>changeFilters({status:event.target.value as WorkspaceFilters["status"]})}><option value="all">전체 상태</option>{Object.entries(workspaceStatusLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    </div>
    <div className={styles.listHeading}><p>{filters.status==="trashed"?"휴지통":"자료"} <strong>{filtered.length}</strong>건 <span>· {paged.page}/{paged.pageCount}페이지</span></p>{canEdit&&<label><input type="checkbox" aria-label={`이 페이지의 선택 가능한 ${pageSelectable.length}건 선택`} checked={allPageSelected} disabled={disabled||!pageSelectable.length} onChange={event=>selectMany(pageSelectable,event.target.checked)}/>이 페이지 {pageSelectable.length}건 선택</label>}</div>
    {canEdit&&selectable.length>pageSelectable.length&&<div className={styles.allResults}><button type="button" disabled={disabled} onClick={()=>selectMany(selectable,true)}>검색 결과의 선택 가능한 {selectable.length}건 모두 선택</button><span>다른 페이지의 자료도 함께 선택합니다.</span></div>}
    <div className={styles.list} role="list" aria-label="자료 목록">
      {!paged.items.length&&<div className={styles.empty}><h2>표시할 자료가 없습니다.</h2><p>{filters.status==="trashed"?"휴지통이 비어 있습니다.":"검색어나 상태 조건을 바꿔 보세요."}</p><button type="button" onClick={()=>changeFilters({query:"",kind:"all",status:"all"})}>전체 자료 보기</button></div>}
      {paged.items.map(item=>{
        const key=workspaceItemKey(item),isOpen=openKey===key;
        const blockers=publicationBlockers(item),isSelectable=selectable.some(candidate=>workspaceItemKey(candidate)===key);
        const sourceHref=safeWorkspaceHref(item.sourceHref),publishedHref=safeWorkspaceHref(item.publishedHref),editorHref=safeWorkspaceHref(item.editorHref);
        return <article className={`${styles.row} ${isOpen?styles.openRow:""}`} role="listitem" key={key}>
          <div className={styles.rowMain}>
            {canEdit&&<input className={styles.rowCheck} type="checkbox" aria-label={`${item.title} 선택`} checked={selected.includes(key)} disabled={disabled||!isSelectable} onChange={event=>toggle(item,event.target.checked)}/>}
            <div className={styles.itemText}><div className={styles.itemMeta}><span>{workspaceKindLabels[item.kind]}</span>{item.jurisdictions.length>0&&<span>{item.jurisdictions.map(jurisdictionName).join(" · ")}</span>}{item.subtitle&&<span>{item.subtitle}</span>}</div><h2 className={styles.itemHeading}><button type="button" className={styles.titleButton} onClick={()=>open(item)} aria-expanded={isOpen} aria-controls={`detail-${key}`}>{item.title}</button></h2>{item.summary&&<p className={styles.summary}>{item.summary}</p>}{visibleFailures.has(key)&&<p className={styles.inlineError}>{visibleFailures.get(key)}</p>}</div>
            <div className={styles.rowStatus}><span className={`${styles.status} ${styles[item.status]}`}>{workspaceStatusLabels[item.status]}</span>{item.hasUnpublishedChanges&&item.status==="published"&&<small>수정본 있음</small>}{blockers.length>0&&item.status!=="trashed"&&<small className={styles.issue}>{blockers[0]}</small>}</div>
            <button className={styles.openButton} type="button" onClick={()=>open(item)} aria-expanded={isOpen}>{isOpen?"접기":"내용 보기"}<span aria-hidden="true">{isOpen?" −":" +"}</span></button>
          </div>
          {isOpen&&<section className={styles.detail} id={`detail-${key}`} aria-label={`${item.title} 상세`}>
            {item.status==="published"&&item.hasUnpublishedChanges&&<p className={styles.changeNotice}>수정본이 있습니다. 현재 공개본은 그대로 유지됩니다. {publishedHref&&<a href={publishedHref} target="_blank" rel="noopener noreferrer">현재 공개본 보기 ↗</a>}</p>}
            {item.status==="published"&&item.hasUnpublishedChanges&&!!item.changes?.length&&<details className={styles.changes}><summary>변경된 내용 {item.changes.length}곳 보기</summary><p>바뀐 부분만 비교해 보세요. 왼쪽은 현재 공개본, 오른쪽은 저장한 수정본입니다.</p>{item.changes.map((change,index)=><section className={styles.change} key={index}><h3>{change.label}</h3><div><section><h4>현재 공개본</h4><p>{change.before||"내용 없음"}</p></section><section><h4>수정본</h4><p>{change.after||"내용 없음"}</p></section></div></section>)}</details>}
            <div className={styles.detailTabs} role="tablist" aria-label="자료 상세 보기">{([['preview',item.hasUnpublishedChanges?'수정본 보기':'공개될 모습'],['edit','내용 수정'],['history','내부 기록']] as [DetailTab,string][]).map(([value,label])=><button id={`tab-${value}-${key}`} role="tab" aria-selected={tab===value} aria-controls={`panel-${key}`} key={value} type="button" disabled={value==="edit"&&(!canEdit||item.status==="trashed")} onClick={()=>setTab(value)}>{label}</button>)}</div>
            <div className={styles.detailBody} id={`panel-${key}`} role="tabpanel" aria-labelledby={`tab-${tab}-${key}`}>
              {tab==="preview"&&<><h3>{item.title}</h3>{item.summary&&<p className={styles.lede}>{item.summary}</p>}{item.body?<div className={styles.body}>{item.body}</div>:item.kind==="law"?<p>법률 전문과 17개 기준 비교표는 상세 화면에서 확인하실 수 있습니다. {editorHref&&<a href={editorHref}>전문·비교표 열기 →</a>}</p>:<p>아직 상세 내용이 없습니다.</p>}{sourceHref&&<a href={sourceHref} target="_blank" rel="noopener noreferrer">{item.sourceTitle||"공식 원문"} ↗</a>}</>}
              {tab==="edit"&&(readOnly?<p>화면 확인용에서는 수정 내용을 저장할 수 없습니다. <a href="https://globaltrend-six.vercel.app/work">운영 작업 공간에서 수정하기 →</a></p>:item.kind==="law"&&item.submitted?<div className={styles.legalEdit}><p>새 제출 자료를 먼저 등록하면 이 화면에서 수정할 수 있습니다. 바로 공개하려면 자료를 선택하고 공개 버튼을 누르세요.</p><a href="/work/new/law">등록 후 내용 수정하기 →</a></div>:item.kind==="law"?<div className={styles.legalEdit}><h3>법제 전문·비교표 수정</h3><p>선정 판본의 한국어 전문과 17개 기준 비교표를 같은 자료로 관리합니다.</p>{editorHref?<a className={styles.linkButton} href={editorHref}>법제 내용 수정하기 →</a>:<p>이 판본의 편집 화면을 불러오지 못했습니다. 화면을 새로고침해 주세요.</p>}</div>:<form key={`${key}:${item.revision}`} className={styles.editor} onSubmit={event=>edit(item,event)}><label>한국어 제목<input name="title" defaultValue={item.title} required maxLength={500} disabled={disabled}/></label><label>핵심 요약<textarea name="summary" defaultValue={item.summary} required rows={3} maxLength={3000} disabled={disabled}/></label><label>상세 내용<textarea name="body" defaultValue={item.body??""} rows={10} maxLength={20000} disabled={disabled}/></label><div className={styles.fieldPair}><label>국가·지역<input name="jurisdictions" defaultValue={item.jurisdictions.join(", ")} placeholder="EU, 영국" disabled={disabled}/></label><label>주제<input name="topics" defaultValue={item.topics?.join(", ")??""} placeholder="아동, 인공지능" disabled={disabled}/></label></div><p>쉼표로 나눠 입력하세요. 저장한 수정본은 공개하기 전까지 외부에 보이지 않습니다.</p><button className={styles.primary} type="submit" disabled={disabled}>{pending==="save_trend"?"저장 중…":"수정본 저장"}</button></form>)}
              {tab==="history"&&<><h3>작업·검토 기록</h3>{item.updatedAt&&<p>최근 수정: {new Date(item.updatedAt).toLocaleString("ko-KR")}</p>}{item.internalRecords?.length?<dl className={styles.records}>{item.internalRecords.map((record,index)=><div key={index}><dt>{record.label}</dt><dd>{record.value}</dd></div>)}</dl>:<p>추가로 표시할 기록이 없습니다.</p>}{(item.issues?.length??0)>0&&<ul>{item.issues?.map((issue,index)=><li key={index}>{issue.message}</li>)}</ul>}</>}
            </div>
            <div className={styles.detailActions}>
              {publishedHref&&item.status==="published"&&<a href={publishedHref} target="_blank" rel="noopener noreferrer">현재 공개본 보기 ↗</a>}
              {canEdit&&item.status==="trashed"&&<button className={styles.secondary} disabled={disabled} type="button" onClick={()=>void run("restore",[item])}>자료 복원</button>}
              {canPublish&&item.status==="published"&&<button className={styles.secondary} disabled={disabled} type="button" onClick={()=>setConfirmation({operation:"unpublish",item})}>공개 취소</button>}
              {canEdit&&item.status!=="trashed"&&<button className={styles.quietDanger} disabled={disabled} type="button" onClick={()=>setConfirmation({operation:"trash",item})}>휴지통으로 이동</button>}
              {canEdit&&canSelectForPublication(item)&&<button className={styles.primary} disabled={disabled} type="button" onClick={()=>void run(canPublish?"publish":"request_publication",[item])}>{pending?"처리 중…":canPublish?item.hasUnpublishedChanges?"수정본 공개":"이 자료 공개":"관리자에게 공개 요청"}</button>}
            </div>
          </section>}
        </article>;
      })}
    </div>
    {paged.pageCount>1&&<nav className={styles.pagination} aria-label="자료 페이지"><button disabled={paged.page===1} type="button" onClick={()=>setPage(paged.page-1)}>← 이전</button><span>{paged.page} / {paged.pageCount}</span><button disabled={paged.page===paged.pageCount} type="button" onClick={()=>setPage(paged.page+1)}>다음 →</button></nav>}
    {canEdit&&<div className={styles.selectionBar}><div><strong>{selectedCount}건 선택</strong><p>{filters.status==="trashed"?"복원하면 작업 공간에서 다시 수정할 수 있습니다.":canPublish?"선택한 자료를 한 번에 공개합니다.":"선택한 자료의 공개를 관리자에게 요청합니다."}</p></div><button className={styles.clear} type="button" disabled={disabled||!selectedCount} onClick={()=>{setSelected([]);selectedRevisions.current.clear();}}>선택 해제</button><button className={styles.primary} type="button" disabled={disabled||!selectedCount} onClick={()=>void run(selectionOperation,selectedItems,undefined,selectedItems.map(item=>({...workspaceTarget(item),revision:selectedRevisions.current.get(workspaceItemKey(item))??item.revision})))}>{pending?`${actionNames[pending]} 처리 중…`:filters.status==="trashed"?`선택한 ${selectedCount}건 복원`:canPublish?`선택한 ${selectedCount}건 공개`:`선택한 ${selectedCount}건 공개 요청`}</button></div>}
    {confirmation&&<div className={styles.modalBackdrop}><section ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="workspace-confirmation"><h2 id="workspace-confirmation">{confirmation.operation==="unpublish"?"공개 사이트에서 내릴까요?":"휴지통으로 옮길까요?"}</h2><p className={styles.confirmTitle}>{confirmation.item.title}</p><p>{confirmation.operation==="unpublish"?"공개 목록과 검색에서 내려갑니다. 자료와 작업 기록은 삭제되지 않습니다.":confirmation.item.status==="published"?"공개 중인 자료는 먼저 공개를 취소해 주세요. 공개 여부는 관리자가 결정합니다.":"자료는 휴지통으로 이동하며 나중에 복원할 수 있습니다."}</p><div><button type="button" className={styles.secondary} onClick={()=>setConfirmation(null)}>돌아가기</button><button type="button" className={styles.danger} disabled={disabled||(confirmation.operation==="trash"&&confirmation.item.status==="published")} onClick={()=>void run(confirmation.operation,[confirmation.item])}>{confirmation.operation==="unpublish"?"공개 취소":"휴지통으로 이동"}</button></div></section></div>}
  </section>;
}
