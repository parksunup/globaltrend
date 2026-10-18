/** Published dates and custom dates use YYYY-MM-DD. Both endpoints are inclusive. */
export function inCustomDateRange(storyDate: string, start: string, end: string): boolean {
  const validDate = /^\d{4}-\d{2}-\d{2}$/;
  return validDate.test(storyDate) && validDate.test(start) && validDate.test(end) &&
    start <= end && storyDate >= start && storyDate <= end;
}
