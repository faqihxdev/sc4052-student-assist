export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high";
export type ChatRole = "user" | "assistant";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  reminder_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  reminder_at?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  reminder_at?: string | null;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
  services: string[] | null;
  traces: ApiTrace[] | null;
  created_at: string;
}

export interface ApiTrace {
  service: string;
  endpoint: string;
  duration_ms: number;
}

export interface ChatRequest {
  message: string;
  history?: { role: ChatRole; content: string }[];
}

export interface ChatResponse {
  response: string;
  services_called: string[];
  traces: ApiTrace[];
  cards: CardData[];
}

export interface CardData {
  type: "calendar" | "tasks" | "github" | "news" | "weather";
  data: unknown;
}

export type ToolDomain = "calendar" | "tasks" | "github" | "news" | "weather";

export type ChatStreamEvent =
  | { type: "step-start" }
  | { type: "step-finish" }
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; text: string }
  | { type: "text-end"; id: string }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      output: unknown;
    }
  | { type: "card"; toolCallId: string; card: CardData }
  | {
      type: "done";
      services_called: string[];
      traces: ApiTrace[];
    }
  | { type: "error"; message: string };

export interface HealthResponse {
  status: "ok";
  timestamp: string;
  version: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export type ServiceName =
  | "calendar"
  | "tasks"
  | "github"
  | "news"
  | "weather";

export interface ServiceStatus {
  service: ServiceName;
  connected: boolean;
  details?: string;
}
