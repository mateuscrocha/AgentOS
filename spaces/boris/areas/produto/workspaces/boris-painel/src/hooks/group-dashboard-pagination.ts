const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_MAX_PAGES = 200;

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  options?: {
    pageSize?: number;
    maxPages?: number;
  },
): Promise<T[]> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const rows: T[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) {
      throw error;
    }

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      return rows;
    }
  }

  throw new Error("Paginação excedeu o limite esperado ao carregar dados do dashboard do grupo.");
}
