import type {
  ChatRequest,
  ChatStreamEvent,
  ServiceStatus,
  Task,
} from "@studentassist/shared";

const BASE_URL = "/api/v1";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
}

export async function fetchServiceStatuses(): Promise<ServiceStatus[]> {
  return apiFetch<ServiceStatus[]>("/settings");
}

export async function saveServiceKey(
  service: string,
  value: string
): Promise<void> {
  await apiFetch(`/settings/${service}`, {
    method: "PUT",
    body: JSON.stringify({ api_key: value }),
  });
}

export async function disconnectGoogle(): Promise<void> {
  await apiFetch("/auth/google", { method: "DELETE" });
}

export function getGoogleAuthUrl(): string {
  return `${BASE_URL}/auth/google`;
}

export async function fetchTasks(): Promise<Task[]> {
  return apiFetch<Task[]>("/tasks");
}

export async function* streamChat(
  request: ChatRequest,
  signal?: AbortSignal
): AsyncGenerator<ChatStreamEvent> {
  const res = await fetch(`${BASE_URL}/chat?stream=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Chat error: ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const event = JSON.parse(trimmed.slice(6)) as ChatStreamEvent;
        yield event;
      } catch {
        // skip malformed lines
      }
    }
  }

  if (buffer.trim().startsWith("data: ")) {
    try {
      const event = JSON.parse(buffer.trim().slice(6)) as ChatStreamEvent;
      yield event;
    } catch {
      // skip
    }
  }
}
