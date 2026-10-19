"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import styles from "./work.module.css";

const Selection = createContext<{selected: string[]; setSelected: (values: string[]) => void}>({selected: [], setSelected: () => {}});

export function PublicationSelection({children}: {children: ReactNode}) {
  const [selected, setSelected] = useState<string[]>([]);
  return <Selection.Provider value={{selected, setSelected}}>{children}</Selection.Provider>;
}

export function PublicationCheckbox({value, title, disabled}: {value: string; title: string; disabled?: boolean}) {
  const {selected, setSelected} = useContext(Selection);
  return <label className={styles.selectItem}><input type="checkbox" aria-label={`${title} 공개 선택`} checked={selected.includes(value)} disabled={disabled}
    onChange={event => setSelected(event.target.checked ? [...selected, value] : selected.filter(item => item !== value))}/><span>공개할 자료로 선택</span></label>;
}

export function PublishButton({disabled, children = "공개 발행"}: {disabled?: boolean; children?: ReactNode}) {
  const {pending} = useFormStatus();
  return <button type="submit" disabled={disabled || pending}>{pending ? "공개 처리 중…" : children}</button>;
}

export function BulkPublication({values, action, disabled}: {values: string[]; action: (form: FormData) => void | Promise<void>; disabled?: boolean}) {
  const {selected, setSelected} = useContext(Selection);
  return <form action={action} className={styles.bulkBar}>
    {selected.map(value => <input key={value} type="hidden" name="selection" value={value}/>)}
    <label><input type="checkbox" disabled={disabled || values.length === 0} checked={values.length > 0 && values.every(value => selected.includes(value))}
      onChange={event => setSelected(event.target.checked ? values : [])}/> 이 목록의 공개 가능 {values.length}건 선택</label>
    <span aria-live="polite">{selected.length}건 선택</span>
    <PublishButton disabled={disabled || selected.length === 0}>선택한 {selected.length}건 공개</PublishButton>
  </form>;
}
