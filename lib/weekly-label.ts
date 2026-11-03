const ISSUE_KEY_PATTERN = /^(\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3]))(?:-(\d+))?$/;
const MONTH_KEY_PATTERN = /^(\d{4}-(?:0[1-9]|1[0-2])-W[1-5])(?:-(\d+))?$/;

/** Convert a Monday date into the site's Monday-anchored month/week label. */
export function formatMonthlyWeek(weekStart: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStart);
  if (!match) throw new Error(`Invalid week start date: ${weekStart}`);
  const [, year, month, day] = match;
  const monday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (monday.toISOString().slice(0, 10) !== weekStart) throw new Error(`Invalid week start date: ${weekStart}`);
  if (monday.getUTCDay() !== 1) throw new Error(`Week start must be a Monday: ${weekStart}`);
  const labelYear = monday.getUTCFullYear();
  const labelMonth = monday.getUTCMonth() + 1;
  const weekOfMonth = Math.ceil(monday.getUTCDate() / 7);
  return `${labelYear}년 ${labelMonth}월 ${weekOfMonth}주`;
}

export function monthlyWeekIssueKey(weekStart: string): string {
  const [, year, month, week] = /^(\d{4})년 (\d{1,2})월 (\d+)주$/.exec(formatMonthlyWeek(weekStart))!;
  return `${year}-${month.padStart(2, '0')}-W${week}`;
}

export function podcastIssueKey(weekStart: string, edition: number): string {
  if (!Number.isSafeInteger(edition) || edition < 1) throw new Error(`Invalid podcast edition: ${edition}`);
  return `${monthlyWeekIssueKey(weekStart)}-${edition}`;
}

/** Old podcast keys without a suffix are the first edition of their week. */
export function podcastEditionNumber(issueKey: string): number {
  const match = MONTH_KEY_PATTERN.exec(issueKey) ?? ISSUE_KEY_PATTERN.exec(issueKey);
  if (!match) throw new Error(`Invalid podcast issue key: ${issueKey}`);
  const edition = match[2] ? Number(match[2]) : 1;
  if (!Number.isSafeInteger(edition) || edition < 1) throw new Error(`Invalid podcast edition: ${issueKey}`);
  return edition;
}
