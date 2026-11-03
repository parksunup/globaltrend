import type {TrendEdit, TeamTrend} from './team-trends';

export function trendEditMatchesRow(edit:TrendEdit,row:TeamTrend) {
  return edit.title_ko===row.title_ko&&edit.summary_ko===row.summary_ko&&edit.details_ko===row.details_ko;
}

export function canPublishTeamTrend(row:TeamTrend) {
  return row.editState!=='conflict'&&(row.status!=='published'||row.editState==='applied');
}
