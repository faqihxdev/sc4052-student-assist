import { FileText, ExternalLink } from "lucide-react";

interface Article {
  story_id?: number | null;
  title?: string;
  url?: string | null;
  source?: string | null;
  content?: string;
  truncated?: boolean;
  posted_text_only?: boolean;
}

interface ArticleCardProps {
  data: unknown;
}

/**
 * Render the first ~280 chars of the fetched article as a preview. The LLM
 * writes its own TL;DR in the text bubble above — this card is just a visual
 * anchor showing "yes, we actually read this thing".
 */
function preview(content?: string, max = 280): string {
  if (!content) return "";
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export default function ArticleCard({ data }: ArticleCardProps) {
  const article = (data ?? {}) as Article;
  const href =
    article.url ??
    (article.story_id
      ? `https://news.ycombinator.com/item?id=${article.story_id}`
      : undefined);

  return (
    <div className="rounded-xl border border-[var(--color-card-news-border)] bg-[var(--color-card-news)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-card-news-border)] px-4 py-2.5">
        <FileText className="h-4 w-4 text-[var(--color-card-news-accent)]" />
        <span className="text-xs font-semibold text-[var(--color-card-news-accent)] uppercase tracking-wide">
          Article
        </span>
        {article.source && (
          <span className="text-xs text-[var(--color-text-muted)] truncate">
            {article.source}
          </span>
        )}
        {article.truncated && (
          <span className="ml-auto rounded-full bg-[var(--color-surface-overlay)] px-2 py-0.5 text-[10px] uppercase text-[var(--color-text-muted)]">
            truncated
          </span>
        )}
      </div>
      <div className="px-4 py-3 space-y-2">
        {article.title && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-amber-accent)] leading-snug"
          >
            {article.title}
          </a>
        )}
        {article.content && (
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {preview(article.content)}
          </p>
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-card-news-accent)] hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Open original
          </a>
        )}
      </div>
    </div>
  );
}
