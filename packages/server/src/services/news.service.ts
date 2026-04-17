const BASE_URL = "https://hacker-news.firebaseio.com/v0";

export interface HNStory {
  id: number;
  title: string;
  url: string | null;
  score: number;
  by: string;
  time: number;
  descendants: number;
}

const ITEM_TIMEOUT_MS = 3_000;
const IDS_TIMEOUT_MS = 5_000;
const SEARCH_POOL_SIZE = 75;
const SEARCH_CONCURRENCY = 15;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchItem(id: number): Promise<any> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/item/${id}.json`,
      ITEM_TIMEOUT_MS
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Treat timeouts and network errors as "missing story" — we'd rather
    // return a partial result set than hang the entire tool call.
    return null;
  }
}

function toStory(item: any): HNStory {
  return {
    id: item.id,
    title: item.title ?? "",
    url: item.url ?? null,
    score: item.score ?? 0,
    by: item.by ?? "",
    time: item.time ?? 0,
    descendants: item.descendants ?? 0,
  };
}

/**
 * Fetch items in bounded-concurrency batches. HN's Firebase endpoint is happy
 * with many requests but the event loop / agent UX is not — unbounded
 * Promise.all on 200 items makes the tool appear frozen for 20+ seconds.
 */
async function fetchItemsPooled(ids: number[], concurrency: number): Promise<any[]> {
  const results = new Array(ids.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= ids.length) return;
      results[idx] = await fetchItem(ids[idx]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, ids.length) },
    worker
  );
  await Promise.all(workers);
  return results;
}

async function fetchTopIds(): Promise<number[]> {
  const res = await fetchWithTimeout(`${BASE_URL}/topstories.json`, IDS_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error("Failed to fetch top stories from HackerNews");
  }
  return (await res.json()) as number[];
}

export async function getTopStories(limit: number = 10): Promise<HNStory[]> {
  const ids = await fetchTopIds();
  const topIds = ids.slice(0, limit);
  const items = await fetchItemsPooled(topIds, SEARCH_CONCURRENCY);
  return items.filter(Boolean).map(toStory);
}

export async function searchStories(
  query: string,
  limit: number = 10
): Promise<HNStory[]> {
  const ids = await fetchTopIds();
  const poolIds = ids.slice(0, Math.min(ids.length, SEARCH_POOL_SIZE));

  const keyword = query.toLowerCase();
  const items = await fetchItemsPooled(poolIds, SEARCH_CONCURRENCY);

  return items
    .filter(
      (item) => item && item.title && item.title.toLowerCase().includes(keyword)
    )
    .map(toStory)
    .slice(0, limit);
}
