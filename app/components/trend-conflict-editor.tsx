"use client";

import { useState, type FormEvent } from "react";
import type { TeamTrend, TrendEdit } from "../../lib/team-trends";
import styles from "./live-team-workspace.module.css";

const fields = [
  ["title_ko", "제목"],
  ["summary_ko", "요약"],
  ["details_ko", "본문"],
] as const;
type Field = (typeof fields)[number][0];
type Choice = "current" | "proposal" | "custom";

export default function TrendConflictEditor({ row, proposal, canSave, onSaved }: {
  row: TeamTrend;
  proposal: TrendEdit;
  canSave: boolean;
  onSaved: () => void;
}) {
  const [base] = useState(() => ({ row, proposal }));
  const [choices, setChoices] = useState<Partial<Record<Field, Choice>>>({});
  const [custom, setCustom] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changed = fields.filter(([key]) => base.row[key] !== base.proposal[key]);
  const stale = base.row.revision !== row.revision || base.row.workspace_revision !== row.workspace_revision;

  function mergedValue(key: Field) {
    if (choices[key] === "proposal") return base.proposal[key];
    if (choices[key] === "custom") return custom[key] ?? base.row[key];
    return base.row[key];
  }

  const complete = changed.every(([key]) => choices[key] && mergedValue(key).trim());

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || saving || stale || !complete) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/team-workspace?role=trends", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edits: [{
            expected_revision: base.row.workspace_revision ?? 0,
            edit: {
              report_id: base.row.id,
              base_revision: base.row.revision,
              title_ko: mergedValue("title_ko"),
              summary_ko: mergedValue("summary_ko"),
              details_ko: mergedValue("details_ko"),
            },
          }],
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "대조 결과를 저장하지 못했습니다.");
      if (result.saved !== 1 || result.published !== false) throw new Error("저장 결과를 확인하지 못했습니다.");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "대조 결과를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details>
      <summary>최신 원고와 Codex 수정본 대조하기</summary>
      <form onSubmit={save} className={styles.conflictForm}>
        <p>{canSave ? "다른 항목마다 반영할 내용을 선택하거나 두 내용을 보고 직접 편집해 주세요." : "서로 다른 내용을 확인할 수 있습니다."}</p>
        {changed.map(([key, label]) => (
          <fieldset key={key} disabled={saving}>
            <legend>{label}</legend>
            <div className={styles.conflictCompare}>
              <div><strong>최신 원고</strong><pre>{base.row[key]}</pre></div>
              <div><strong>저장된 Codex 수정본</strong><pre>{base.proposal[key]}</pre></div>
            </div>
            {canSave && <label>반영할 {label}
              <select value={choices[key] ?? ""} onChange={event => setChoices(value => ({ ...value, [key]: event.target.value as Choice }))}>
                <option value="" disabled>선택해 주세요</option>
                <option value="current">최신 원고 유지</option>
                <option value="proposal">Codex 수정본 사용</option>
                <option value="custom">직접 편집</option>
              </select>
            </label>}
            {canSave && choices[key] === "custom" && <label>새 {label}
              <textarea rows={key === "details_ko" ? 10 : 3} maxLength={100000} required value={custom[key] ?? base.row[key]}
                onChange={event => setCustom(value => ({ ...value, [key]: event.target.value }))} />
            </label>}
          </fieldset>
        ))}
        {stale && <p role="alert">대조 중 원고가 변경됐습니다. 작성 중인 내용을 복사한 뒤 최신 원고를 다시 불러와 주세요.</p>}
        {error && <p role="alert">{error}</p>}
        {canSave && <button type="submit" disabled={saving || stale || !complete}>{saving ? "저장 중…" : "대조 결과를 비공개로 저장"}</button>}
      </form>
    </details>
  );
}
