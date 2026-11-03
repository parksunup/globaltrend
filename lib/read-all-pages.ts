/** Read every row in stable database order without a UI-imposed result cap. */
export async function readAllPages<T>(readPage: (offset: number, count: number) => Promise<T[]>, pageSize = 500): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await readPage(offset, pageSize);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
