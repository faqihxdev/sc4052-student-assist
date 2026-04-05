import { Github, Star, GitFork, GitPullRequest, CircleDot, GitCommit } from "lucide-react";

interface RepoItem {
  name?: string;
  full_name?: string;
  html_url?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  updated_at?: string;
}

interface ActivityData {
  commits?: Array<{ sha?: string; message?: string; author?: string; date?: string; html_url?: string }>;
  pull_requests?: Array<{ title?: string; number?: number; state?: string; html_url?: string; user?: string }>;
  issues?: Array<{ title?: string; number?: number; state?: string; html_url?: string; user?: string }>;
  repos?: RepoItem[];
}

interface GitHubCardProps {
  data: unknown;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-400",
  JavaScript: "bg-yellow-400",
  Python: "bg-green-500",
  Rust: "bg-orange-500",
  Go: "bg-cyan-400",
  Java: "bg-red-500",
  C: "bg-gray-400",
  "C++": "bg-pink-500",
  "C#": "bg-purple-500",
  Ruby: "bg-red-400",
  Swift: "bg-orange-400",
  Kotlin: "bg-purple-400",
  HTML: "bg-orange-500",
  CSS: "bg-indigo-400",
  Shell: "bg-green-400",
};

export default function GitHubCard({ data }: GitHubCardProps) {
  const d = data as ActivityData;

  if (d.repos && d.repos.length > 0) {
    return <RepoList repos={d.repos} />;
  }

  const hasActivity =
    (d.commits && d.commits.length > 0) ||
    (d.pull_requests && d.pull_requests.length > 0) ||
    (d.issues && d.issues.length > 0);

  if (hasActivity) {
    return <ActivitySummary data={d} />;
  }

  return (
    <div className="rounded-xl border border-[var(--color-card-github-border)] bg-[var(--color-card-github)] p-4">
      <div className="flex items-center gap-2 text-sm text-[var(--color-card-github-accent)]">
        <Github className="h-4 w-4" />
        <span className="font-medium">No GitHub data</span>
      </div>
    </div>
  );
}

function RepoList({ repos }: { repos: RepoItem[] }) {
  return (
    <div className="rounded-xl border border-[var(--color-card-github-border)] bg-[var(--color-card-github)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-card-github-border)] px-4 py-2.5">
        <Github className="h-4 w-4 text-[var(--color-card-github-accent)]" />
        <span className="text-xs font-semibold text-[var(--color-card-github-accent)] uppercase tracking-wide">
          Repositories
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">{repos.length}</span>
      </div>
      <div className="divide-y divide-[var(--color-card-github-border)]/30 max-h-72 overflow-y-auto scrollbar-thin">
        {repos.slice(0, 10).map((repo, i) => (
          <div key={i} className="px-4 py-2.5 transition-colors hover:bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <a
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--color-amber-accent)] hover:underline truncate"
              >
                {repo.name}
              </a>
              {repo.language && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                  <span className={`h-2 w-2 rounded-full ${LANG_COLORS[repo.language] || "bg-gray-500"}`} />
                  {repo.language}
                </span>
              )}
            </div>
            {repo.description && (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)] truncate">{repo.description}</p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
              {repo.stargazers_count != null && (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3" /> {repo.stargazers_count}
                </span>
              )}
              {repo.forks_count != null && (
                <span className="inline-flex items-center gap-1">
                  <GitFork className="h-3 w-3" /> {repo.forks_count}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivitySummary({ data }: { data: ActivityData }) {
  return (
    <div className="rounded-xl border border-[var(--color-card-github-border)] bg-[var(--color-card-github)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-card-github-border)] px-4 py-2.5">
        <Github className="h-4 w-4 text-[var(--color-card-github-accent)]" />
        <span className="text-xs font-semibold text-[var(--color-card-github-accent)] uppercase tracking-wide">
          Activity
        </span>
      </div>
      <div className="p-4 space-y-3">
        {data.commits && data.commits.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
              <GitCommit className="h-3.5 w-3.5" /> Commits ({data.commits.length})
            </h4>
            <div className="space-y-1">
              {data.commits.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <code className="text-[var(--color-text-muted)] font-mono">{c.sha?.slice(0, 7)}</code>
                  <a
                    href={c.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-text-secondary)] hover:text-[var(--color-amber-accent)] truncate"
                  >
                    {c.message?.split("\n")[0]}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
        {data.pull_requests && data.pull_requests.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
              <GitPullRequest className="h-3.5 w-3.5" /> Pull Requests ({data.pull_requests.length})
            </h4>
            <div className="space-y-1">
              {data.pull_requests.slice(0, 5).map((pr, i) => (
                <a
                  key={i}
                  href={pr.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-amber-accent)]"
                >
                  <span className={`h-2 w-2 rounded-full ${pr.state === "open" ? "bg-[var(--color-success)]" : "bg-purple-400"}`} />
                  <span className="truncate">#{pr.number} {pr.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
        {data.issues && data.issues.length > 0 && (
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
              <CircleDot className="h-3.5 w-3.5" /> Issues ({data.issues.length})
            </h4>
            <div className="space-y-1">
              {data.issues.slice(0, 5).map((issue, i) => (
                <a
                  key={i}
                  href={issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-amber-accent)]"
                >
                  <span className={`h-2 w-2 rounded-full ${issue.state === "open" ? "bg-[var(--color-success)]" : "bg-[var(--color-error)]"}`} />
                  <span className="truncate">#{issue.number} {issue.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
