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

// --- Article reader --------------------------------------------------------
//
// Given either an HN story id or a bare URL, fetch the page HTML and produce
// a compact plain-text version suitable for the LLM to TL;DR. We deliberately
// avoid pulling in a readability lib / jsdom because:
//   1. The input surface is narrow (HN-linked articles, blogs, docs) where
//      the heuristic below gets 95% of the way there.
//   2. The LLM is forgiving of ragged extraction — it just needs enough
//      signal to summarize.
// If something goes wrong we throw a user-surfaceable message; the orchestrator
// rewrites tool errors into a short apology in chat.

const ARTICLE_TIMEOUT_MS = 8_000;
const MAX_CONTENT_CHARS = 12_000;

export interface Article {
  story_id: number | null;
  title: string;
  url: string | null;
  source: string | null;
  content: string;
  truncated: boolean;
  posted_text_only: boolean; // true = Ask/Show HN text post with no external URL
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Decode the handful of HTML entities we actually see. A full entity map is
 * overkill — anything exotic just falls through unchanged.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/**
 * Strip HTML to a readable plain-text blob. Drops script/style/nav/footer
 * chrome, collapses whitespace, and keeps paragraph/line breaks as double
 * newlines so the LLM can see document structure.
 */
function htmlToText(html: string): string {
  let s = html;

  // Drop non-content blocks wholesale (including their contents).
  s = s.replace(
    /<(script|style|noscript|iframe|svg|template|head|nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi,
    " "
  );

  // Prefer <main> or <article> body if present — strong signal of real content.
  const mainMatch =
    s.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
    s.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) s = mainMatch[1];

  // Convert block-level boundaries to newlines.
  s = s.replace(/<\/(p|div|section|li|h[1-6]|br|tr)\b[^>]*>/gi, "\n");
  s = s.replace(/<br\b[^>]*>/gi, "\n");

  // Strip all remaining tags.
  s = s.replace(/<[^>]+>/g, "");

  s = decodeEntities(s);

  // Collapse whitespace: runs of spaces/tabs → single space, 3+ newlines → 2.
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n[ \t]+/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

export async function readArticle(input: {
  storyId?: number;
  url?: string;
}): Promise<Article> {
  let { storyId, url } = input;
  let title = "";
  let postedText: string | null = null;

  if (storyId != null) {
    const item = await fetchItem(storyId);
    if (!item) {
      throw new Error(`HackerNews story ${storyId} not found`);
    }
    title = item.title ?? "";
    // Ask HN / Show HN text posts have inline HTML in `item.text` and no external url.
    if (item.text) postedText = item.text as string;
    if (!url && item.url) url = item.url as string;
  }

  if (!url && postedText) {
    // Pure text post — no article to fetch, just use the embedded text.
    const content = htmlToText(postedText);
    return {
      story_id: storyId ?? null,
      title,
      url: null,
      source: "news.ycombinator.com",
      content: content.slice(0, MAX_CONTENT_CHARS),
      truncated: content.length > MAX_CONTENT_CHARS,
      posted_text_only: true,
    };
  }

  if (!url) {
    throw new Error(
      "No URL to read; this story has no linked article. Try another story."
    );
  }

  const res = await fetchWithTimeout(url, ARTICLE_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`Failed to fetch article (HTTP ${res.status}).`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new Error(
      `Cannot read this link; it's ${contentType || "not HTML"} (likely a PDF, video, or binary).`
    );
  }

  const html = await res.text();

  // If HN didn't give us a title, try to pull one from the page.
  if (!title) {
    const m =
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ??
      html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (m) title = decodeEntities(m[1]).trim();
  }

  const content = htmlToText(html);

  return {
    story_id: storyId ?? null,
    title,
    url,
    source: hostnameOf(url),
    content: content.slice(0, MAX_CONTENT_CHARS),
    truncated: content.length > MAX_CONTENT_CHARS,
    posted_text_only: false,
  };
}
