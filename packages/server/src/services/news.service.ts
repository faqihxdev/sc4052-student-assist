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

async function fetchItem(id: number): Promise<any> {
  const res = await fetch(`${BASE_URL}/item/${id}.json`);
  if (!res.ok) return null;
  return res.json();
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

export async function getTopStories(limit: number = 10): Promise<HNStory[]> {
  const res = await fetch(`${BASE_URL}/topstories.json`);
  if (!res.ok) {
    throw new Error("Failed to fetch top stories from HackerNews");
  }

  const ids: number[] = await res.json();
  const topIds = ids.slice(0, limit);

  const items = await Promise.all(topIds.map(fetchItem));

  return items.filter(Boolean).map(toStory);
}

export async function searchStories(
  query: string,
  limit: number = 10
): Promise<HNStory[]> {
  const res = await fetch(`${BASE_URL}/topstories.json`);
  if (!res.ok) {
    throw new Error("Failed to fetch top stories from HackerNews");
  }

  const ids: number[] = await res.json();
  // Fetch a larger batch to filter from (up to 200 stories)
  const batchSize = Math.min(ids.length, 200);
  const items = await Promise.all(ids.slice(0, batchSize).map(fetchItem));

  const keyword = query.toLowerCase();
  return items
    .filter(
      (item) =>
        item &&
        item.title &&
        item.title.toLowerCase().includes(keyword)
    )
    .map(toStory)
    .slice(0, limit);
}
