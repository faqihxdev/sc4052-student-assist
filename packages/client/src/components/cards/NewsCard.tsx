import { Newspaper, ExternalLink, MessageSquare, User } from "lucide-react";

interface NewsStory {
  title?: string;
  url?: string;
  score?: number;
  by?: string;
  descendants?: number;
  id?: number;
  time?: number;
}

interface NewsCardProps {
  data: unknown;
}

function timeAgo(timestamp?: number): string {
  if (!timestamp) return "";
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getDomain(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

export default function NewsCard({ data }: NewsCardProps) {
  const stories: NewsStory[] = Array.isArray(data) ? data : [];

  if (!stories.length) {
    return (
      <div className="rounded-xl border border-[var(--color-card-news-border)] bg-[var(--color-card-news)] p-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-card-news-accent)]">
          <Newspaper className="h-4 w-4" />
          <span className="font-medium">No stories found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-card-news-border)] bg-[var(--color-card-news)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-card-news-border)] px-4 py-2.5">
        <Newspaper className="h-4 w-4 text-[var(--color-card-news-accent)]" />
        <span className="text-xs font-semibold text-[var(--color-card-news-accent)] uppercase tracking-wide">
          Hacker News
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">{stories.length} stories</span>
      </div>
      <div className="divide-y divide-[var(--color-card-news-border)]/30 max-h-80 overflow-y-auto scrollbar-thin">
        {stories.map((story, i) => (
          <div key={story.id ?? i} className="px-4 py-2.5 transition-colors hover:bg-white/[0.03]">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-card-news-accent)]/15 text-xs font-bold text-[var(--color-card-news-accent)]">
                {story.score ?? 0}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={story.url || `https://news.ycombinator.com/item?id=${story.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-amber-accent)] leading-snug"
                >
                  {story.title}
                </a>
                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                  {story.url && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <ExternalLink className="h-3 w-3" /> {getDomain(story.url)}
                    </span>
                  )}
                  {story.by && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" /> {story.by}
                    </span>
                  )}
                  {story.descendants != null && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> {story.descendants}
                    </span>
                  )}
                  {story.time && <span>{timeAgo(story.time)}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
