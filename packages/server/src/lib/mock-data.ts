import type {
  CalendarEvent,
  FreeBusyResult,
  CreateEventInput,
  UpdateEventInput,
} from "../services/calendar.service";
import type { GitHubRepo, RepoActivity, GitHubIssue } from "../services/github.service";
import type { CurrentWeather, Forecast } from "../services/weather.service";

function today(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

let mockEventIdCounter = 100;

// ── Calendar mock data ────────────────────────────────────────────

export function getMockTodaysEvents(): CalendarEvent[] {
  return [
    {
      id: "mock-1",
      summary: "CZ4052 Cloud Computing Lecture",
      description: "Week 12 — Microservices & Containerization",
      location: "LT19, North Spine",
      start: today(10, 0),
      end: today(11, 30),
      all_day: false,
      html_link: "#",
      status: "confirmed",
    },
    {
      id: "mock-2",
      summary: "SC3000 AI Group Meeting",
      description: "Discuss final project integration",
      location: "The Hive Level 3, NTU",
      start: today(14, 0),
      end: today(15, 0),
      all_day: false,
      html_link: "#",
      status: "confirmed",
    },
    {
      id: "mock-3",
      summary: "TA Office Hours — CZ2005",
      description: null,
      location: "SCSE Lab 2",
      start: today(16, 0),
      end: today(17, 0),
      all_day: false,
      html_link: "#",
      status: "confirmed",
    },
    {
      id: "mock-4",
      summary: "Gym Session",
      description: null,
      location: "NTU Sports & Recreation Centre",
      start: today(18, 30),
      end: today(19, 30),
      all_day: false,
      html_link: "#",
      status: "confirmed",
    },
  ];
}

export function getMockEvents(_timeMin?: string, _timeMax?: string): CalendarEvent[] {
  return getMockTodaysEvents();
}

export function getMockFreeBusy(date: string): FreeBusyResult {
  return {
    date,
    busy: [
      { start: today(10, 0), end: today(11, 30) },
      { start: today(14, 0), end: today(15, 0) },
      { start: today(16, 0), end: today(17, 0) },
      { start: today(18, 30), end: today(19, 30) },
    ],
    free: [
      { start: today(0, 0), end: today(10, 0) },
      { start: today(11, 30), end: today(14, 0) },
      { start: today(15, 0), end: today(16, 0) },
      { start: today(17, 0), end: today(18, 30) },
      { start: today(19, 30), end: today(23, 59) },
    ],
  };
}

export function getMockCreateEvent(input: CreateEventInput): CalendarEvent {
  return {
    id: `mock-${++mockEventIdCounter}`,
    summary: input.summary,
    description: input.description ?? null,
    location: input.location ?? null,
    start: input.start,
    end: input.end,
    all_day: false,
    html_link: "#",
    status: "confirmed",
  };
}

export function getMockUpdateEvent(
  id: string,
  input: UpdateEventInput
): CalendarEvent {
  return {
    id,
    summary: input.summary ?? "Updated mock event",
    description: input.description ?? null,
    location: input.location ?? null,
    start: input.start ?? today(9, 0),
    end: input.end ?? today(10, 0),
    all_day: false,
    html_link: "#",
    status: "confirmed",
  };
}

export function getMockDeleteEvent(id: string): { id: string } {
  return { id };
}

// ── GitHub mock data ──────────────────────────────────────────────

export function getMockRepos(): GitHubRepo[] {
  return [
    {
      id: 1001,
      name: "cloud-computing-project",
      full_name: "alextan/cloud-computing-project",
      description: "CZ4052 Cloud Computing final project — StudentAssist PA-as-a-Service",
      html_url: "https://github.com/alextan/cloud-computing-project",
      language: "TypeScript",
      stargazers_count: 3,
      forks_count: 0,
      open_issues_count: 4,
      private: false,
      updated_at: new Date().toISOString(),
      pushed_at: new Date().toISOString(),
    },
    {
      id: 1002,
      name: "ai-group-project",
      full_name: "alextan/ai-group-project",
      description: "SC3000 Artificial Intelligence — Group project on reinforcement learning",
      html_url: "https://github.com/alextan/ai-group-project",
      language: "Python",
      stargazers_count: 1,
      forks_count: 2,
      open_issues_count: 6,
      private: true,
      updated_at: new Date(Date.now() - 86400000).toISOString(),
      pushed_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 1003,
      name: "leetcode-solutions",
      full_name: "alextan/leetcode-solutions",
      description: "My LeetCode solutions in Python and TypeScript",
      html_url: "https://github.com/alextan/leetcode-solutions",
      language: "Python",
      stargazers_count: 12,
      forks_count: 3,
      open_issues_count: 0,
      private: false,
      updated_at: new Date(Date.now() - 172800000).toISOString(),
      pushed_at: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 1004,
      name: "dotfiles",
      full_name: "alextan/dotfiles",
      description: "My development environment config files",
      html_url: "https://github.com/alextan/dotfiles",
      language: "Shell",
      stargazers_count: 5,
      forks_count: 1,
      open_issues_count: 0,
      private: false,
      updated_at: new Date(Date.now() - 604800000).toISOString(),
      pushed_at: new Date(Date.now() - 604800000).toISOString(),
    },
  ];
}

export function getMockRepoActivity(owner: string, repo: string): RepoActivity {
  return {
    owner,
    repo,
    commits: [
      { sha: "a1b2c3d", message: "feat: add SSE streaming for chat endpoint", author: "alextan", date: new Date(Date.now() - 3600000).toISOString(), html_url: "#" },
      { sha: "e4f5g6h", message: "fix: handle parallel tool calls in orchestrator", author: "alextan", date: new Date(Date.now() - 7200000).toISOString(), html_url: "#" },
      { sha: "i7j8k9l", message: "chore: update Docker multi-stage build", author: "alextan", date: new Date(Date.now() - 86400000).toISOString(), html_url: "#" },
      { sha: "m0n1o2p", message: "feat: add Weather service with OpenWeatherMap API", author: "alextan", date: new Date(Date.now() - 172800000).toISOString(), html_url: "#" },
      { sha: "q3r4s5t", message: "feat: implement Calendar service with Google OAuth", author: "alextan", date: new Date(Date.now() - 259200000).toISOString(), html_url: "#" },
    ],
    pull_requests: [
      { number: 12, title: "feat: add frontend chat UI with streaming", state: "open", user: "alextan", html_url: "#", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { number: 11, title: "feat: AI orchestrator with 15 tools", state: "closed", user: "alextan", html_url: "#", created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 43200000).toISOString() },
      { number: 10, title: "feat: add GitHub service", state: "closed", user: "alextan", html_url: "#", created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 129600000).toISOString() },
    ],
    issues: [
      { number: 8, title: "Add mock mode for services without API keys", state: "open", labels: ["enhancement"], html_url: "#", repository: `${owner}/${repo}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { number: 7, title: "Weather card shows wrong icon for night time", state: "open", labels: ["bug"], html_url: "#", repository: `${owner}/${repo}`, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString() },
      { number: 5, title: "Docker build fails on Windows due to symlinks", state: "closed", labels: ["bug", "docker"], html_url: "#", repository: `${owner}/${repo}`, created_at: new Date(Date.now() - 259200000).toISOString(), updated_at: new Date(Date.now() - 172800000).toISOString() },
      { number: 3, title: "Set up CI/CD with GitHub Actions", state: "open", labels: ["infrastructure"], html_url: "#", repository: `${owner}/${repo}`, created_at: new Date(Date.now() - 604800000).toISOString(), updated_at: new Date(Date.now() - 604800000).toISOString() },
    ],
  };
}

export function getMockAssignedIssues(): GitHubIssue[] {
  return [
    { number: 8, title: "Add mock mode for services without API keys", state: "open", labels: ["enhancement"], html_url: "#", repository: "alextan/cloud-computing-project", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { number: 7, title: "Weather card shows wrong icon for night time", state: "open", labels: ["bug"], html_url: "#", repository: "alextan/cloud-computing-project", created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString() },
    { number: 15, title: "Implement reward shaping for maze environment", state: "open", labels: ["RL", "experiment"], html_url: "#", repository: "alextan/ai-group-project", created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 172800000).toISOString() },
    { number: 14, title: "Write evaluation section for report", state: "open", labels: ["documentation"], html_url: "#", repository: "alextan/ai-group-project", created_at: new Date(Date.now() - 259200000).toISOString(), updated_at: new Date(Date.now() - 259200000).toISOString() },
  ];
}

// ── Weather mock data ─────────────────────────────────────────────

export function getMockCurrentWeather(city?: string): CurrentWeather {
  return {
    city: city || "Singapore",
    country: "SG",
    temperature: 31,
    feels_like: 35,
    humidity: 74,
    description: "partly cloudy",
    icon: "02d",
    wind_speed: 3.1,
    timestamp: new Date().toISOString(),
  };
}

export function getMockForecast(city?: string): Forecast {
  const base = Date.now();
  const entries = [];
  for (let i = 0; i < 8; i++) {
    const dt = new Date(base + i * 3 * 3600000);
    const hour = dt.getHours();
    const isDay = hour >= 6 && hour < 19;
    const temps = [29, 30, 32, 33, 32, 31, 29, 28];
    const descs = ["scattered clouds", "light rain", "partly cloudy", "overcast clouds", "thunderstorm", "clear sky", "few clouds", "moderate rain"];
    const icons = isDay
      ? ["03d", "10d", "02d", "04d", "11d", "01d", "02d", "10d"]
      : ["03n", "10n", "02n", "04n", "11n", "01n", "02n", "10n"];
    entries.push({
      datetime: dt.toISOString().replace("T", " ").substring(0, 19),
      temperature: temps[i],
      feels_like: temps[i] + 3,
      humidity: 65 + i * 3,
      description: descs[i],
      icon: icons[i],
      wind_speed: 2 + i * 0.5,
    });
  }
  return {
    city: city || "Singapore",
    country: "SG",
    entries,
  };
}
