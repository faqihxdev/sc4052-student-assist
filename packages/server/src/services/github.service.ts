import { Octokit } from "@octokit/rest";
import { AppError } from "../lib/errors";
import { config } from "../lib/config";
import { getApiKeyForService } from "./settings.service";
import {
  getMockRepos,
  getMockRepoActivity,
  getMockAssignedIssues,
} from "../lib/mock-data";

function useMockGitHub(): boolean {
  if (config.mockMode) return true;
  return !getApiKeyForService("github");
}

function getOctokit(): Octokit {
  const token = getApiKeyForService("github");
  if (!token) {
    throw new AppError(
      503,
      "GitHub service unavailable: No GitHub token configured. " +
        "Set GITHUB_TOKEN in your .env file or configure it in Settings."
    );
  }
  return new Octokit({ auth: token });
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  private: boolean;
  updated_at: string | null;
  pushed_at: string | null;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  html_url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  user: string;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  labels: string[];
  html_url: string;
  repository: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepoActivity {
  owner: string;
  repo: string;
  commits: GitHubCommit[];
  pull_requests: GitHubPullRequest[];
  issues: GitHubIssue[];
}

export async function listUserRepos(): Promise<GitHubRepo[]> {
  if (useMockGitHub()) return getMockRepos();

  const octokit = getOctokit();

  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 30,
  });

  return data.map((repo) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description ?? null,
    html_url: repo.html_url,
    language: repo.language ?? null,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
    private: repo.private,
    updated_at: repo.updated_at ?? null,
    pushed_at: repo.pushed_at ?? null,
  }));
}

export async function getRepoActivity(
  owner: string,
  repo: string
): Promise<RepoActivity> {
  if (useMockGitHub()) return getMockRepoActivity(owner, repo);

  const octokit = getOctokit();

  const [commitsRes, prsRes, issuesRes] = await Promise.all([
    octokit.rest.repos
      .listCommits({ owner, repo, per_page: 10 })
      .catch(() => ({ data: [] })),
    octokit.rest.pulls
      .list({ owner, repo, state: "all", sort: "updated", per_page: 10 })
      .catch(() => ({ data: [] })),
    octokit.rest.issues
      .listForRepo({
        owner,
        repo,
        state: "all",
        sort: "updated",
        per_page: 10,
      })
      .catch(() => ({ data: [] })),
  ]);

  const commits: GitHubCommit[] = commitsRes.data.map((c: any) => ({
    sha: c.sha.substring(0, 7),
    message: c.commit.message.split("\n")[0],
    author: c.commit.author?.name ?? c.author?.login ?? "unknown",
    date: c.commit.author?.date ?? "",
    html_url: c.html_url,
  }));

  const pull_requests: GitHubPullRequest[] = prsRes.data.map((pr: any) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    user: pr.user?.login ?? "unknown",
    html_url: pr.html_url,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
  }));

  // Filter out pull requests from issues (GitHub API returns PRs as issues too)
  const issues: GitHubIssue[] = issuesRes.data
    .filter((i: any) => !i.pull_request)
    .map((i: any) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      labels: i.labels.map((l: any) => (typeof l === "string" ? l : l.name)),
      html_url: i.html_url,
      repository: `${owner}/${repo}`,
      created_at: i.created_at,
      updated_at: i.updated_at,
    }));

  return { owner, repo, commits, pull_requests, issues };
}

export async function listAssignedIssues(): Promise<GitHubIssue[]> {
  if (useMockGitHub()) return getMockAssignedIssues();

  const octokit = getOctokit();

  const { data } = await octokit.rest.issues.list({
    filter: "assigned",
    state: "open",
    sort: "updated",
    per_page: 30,
  });

  return data
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      labels: i.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
      html_url: i.html_url,
      repository: i.repository?.full_name ?? null,
      created_at: i.created_at,
      updated_at: i.updated_at,
    }));
}
