/** Immutable registered criterion versions: legacy snapshots remain readable. */
export const LEGAL_CRITERIA_V1 = [
  "personal_information_scope",
  "law_application_scope",
  "privacy_principles",
  "data_subject_rights",
  "processing_basis_collection",
  "processing_basis_use",
  "third_party_provision",
  "sensitive_information",
  "pseudonymous_anonymous_information",
  "children_information",
  "security_measures",
  "processor_contracting",
  "cross_border_transfer",
  "administrative_fines",
  "corrective_measures",
  "breach_notification",
  "data_use_promotion"
] as const;
export const LEGAL_CRITERIA_V2 = [...LEGAL_CRITERIA_V1, "extraterritorial_scope"] as const;

export function hasCompleteLegalCriteria(cells: readonly { criterionId: string }[], currentOnly = false): boolean {
  const actual = new Set(cells.map((cell) => cell.criterionId));
  if (actual.size !== cells.length) return false;
  const versions: readonly (readonly string[])[] = currentOnly ? [LEGAL_CRITERIA_V2] : [LEGAL_CRITERIA_V1, LEGAL_CRITERIA_V2];
  return versions.some((expected) => expected.length === actual.size && expected.every((id) => actual.has(id)));
}
