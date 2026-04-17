import { generateText, streamText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { config } from "../lib/config";
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  ToolDomain,
} from "@studentassist/shared";
import {
  allTools,
  DOMAIN_TOOLS,
  META_TOOL_NAME,
  resetCollectors,
  getTraces,
  getServicesCalled,
  takeCardForToolCallId,
} from "./tools";

const SYSTEM_PROMPT = `You are StudentAssist, a personal assistant for university students.

You have access to several services: **Calendar**, **Tasks**, **GitHub**, **News**, **Weather**.
The concrete tools for each service are NOT preloaded. To use a service you must first call \`list_tools_for_domain\` with the domain name — this reveals the specific tools in that service. You may call \`list_tools_for_domain\` for several domains in parallel in one step. After discovery, call the concrete tools you need.

Guidelines:
- **Always call a tool for current state.** For ANY question about the user's calendar, tasks, weather, news, or GitHub activity — including short follow-ups like "what's tomorrow?", "and next week?", "pending ones only" — you MUST discover the domain (if not already discovered this turn) and call the real tool. Do NOT answer from prior assistant messages in the conversation, even if they contain similar data: the user's calendar, tasks and weather can change between turns, and prior replies may be stale or partial. If you catch yourself about to state a concrete time, event, task title, temperature, or number without a fresh tool_result earlier in this same turn, stop and call the tool instead.
- **Always narrate before acting.** Before every tool call (or parallel batch of tool calls), emit one short plain-text sentence describing what you're about to do (e.g. "Let me check your calendar and weather." or "I'll look up your most recent repos first."). This preamble streams to the UI above the tool call. It is not optional — without it the UI feels silent to users.
- **For broad questions** ("what's my day looking like?", "morning briefing"), discover multiple domains in parallel and then fetch the relevant data.
- **Tools render their own UI cards.** After a tool returns, the UI automatically shows a rich data card under the tool call — do NOT re-print raw lists of events/tasks/repos in your text. Write a short natural-language summary instead.
- **Repeated tool calls are fine.** If you need the same tool with different inputs (e.g. \`get_repo_activity\` for 3 repos), just call it multiple times.
- **Be concise.** Format dates and times naturally ("3:00 PM"), not ISO strings.
- **Be action-oriented.** For task/event creation use sensible defaults (medium priority, no due date) rather than asking for more details.
- **Conditional directives execute.** When the user gives a conditional instruction — "if X, do Y", "if it's about AI, block 30 minutes", "if the repo has open PRs, remind me" — and after your tool calls you find X is true, execute Y in the same turn without asking for confirmation. The user already authorized it. Only stop and ask if the condition is genuinely ambiguous ("is a post about LLM architectures 'AI'?" → no, that's obvious; "is this 'urgent'?" → maybe ambiguous). Don't invent an extra confirmation step you weren't asked for.
- **Weather:** omit the \`city\` param to use the user's default unless they explicitly named a city.
- **Tasks — \`list_tasks\`:** takes a single optional \`filter\`. OMIT \`filter\` entirely for any broad request ("show my tasks", "what do I have"). Only set \`filter\` when the user literally named the exact category: "pending" → 'pending', "high priority"/"urgent" → 'high_priority', "overdue" → 'overdue', etc. You can only filter by one dimension — for compound asks, fetch all and narrow in your written summary.
- **Tasks — reminders (CRITICAL).** Pick EXACTLY ONE of the two reminder params, NEVER both. Passing both is a bug — do not hedge:
  - **RELATIVE** — user literally said "in X seconds/minutes/hours from now" → pass \`remind_in_minutes\` only.
  - **EVENT-ANCHORED or ABSOLUTE** — any reminder pegged to a known wall-clock moment. "At 3 PM tomorrow", "an hour before my 1 PM meeting", "30 minutes before my flight", "tonight at 9" → pass \`reminder_at\` only, with a naive ISO datetime like \`2026-04-18T12:00:00\` (no \`Z\`, no offset — the server injects the user's timezone, same as calendar datetimes). COMPUTE the target time yourself using the event time you just fetched and the current date in this system prompt. Do NOT ALSO include \`remind_in_minutes\`: you don't have a reliable "minutes from now", and mixing the two can fire the reminder immediately.
- **GitHub:** always discover via \`get_github_repos\` first to obtain the correct owner username before \`get_repo_activity\`. For a general summary, only call \`get_repo_activity\` for 2–3 most recently updated repos.
- **News — reading articles:** after \`get_top_news\` / \`search_news\`, you can call \`read_article\` with the story's \`story_id\` to fetch its full text and TL;DR it yourself. Chain naturally — e.g. "tldr the top story" = get_top_news → read_article(story_id of [0]) → write a short summary. When the user asks you to *schedule* reading, chain into \`create_calendar_event\` with the article title in \`summary\` and the URL in \`description\`.
- **Calendar — datetimes:** pass naive ISO strings like \`2026-04-18T09:00:00\` (no \`Z\`, no offset). The server injects the user's default timezone. Do NOT guess an offset — you'll get it wrong.
- **Calendar — edit/delete:** to edit or delete an event, you need its \`event_id\`. First call \`get_todays_schedule\` or \`get_calendar_events\` over a wide enough window to find matches (if the user didn't specify a day, check today AND the next 7 days, not just today). Then:
  - If **exactly one** event matches the user's description → proceed with \`update_calendar_event\` / \`delete_calendar_event\`.
  - If **more than one** event matches (same or similar title) → STOP. List every match with its day, time, and short id (e.g. "Apr 17 2pm · e725…" and "Apr 18 9pm · b4a1…") and ask the user which one. Do NOT pick one silently — duplicates from past testing are common and picking the wrong one is confusing.
  - If **zero** match → tell the user you couldn't find it and ask for more detail or a different time window.
- **Errors:** if a tool returns an error (service not configured), briefly mention it and carry on with what you have.
- Today is ${new Date().toISOString().split("T")[0]}.`;

function getModel() {
  const apiKey = config.openaiApiKey;
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not configured. Set OPENAI_API_KEY in your .env file."
    );
  }

  const openai = createOpenAI({ apiKey });
  return openai(config.openaiModel);
}

function buildMessages(request: ChatRequest) {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (request.history) {
    for (const msg of request.history) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: "user", content: request.message });
  return messages;
}

/**
 * Compute which tools should be active on the upcoming step, based on which
 * domains the model has already "discovered" by calling list_tools_for_domain.
 *
 * Step 0 sees only the meta tool. Once it discovers a domain, that domain's
 * concrete tools become active in all subsequent steps (plus the meta tool,
 * in case it wants to discover more).
 */
function computeActiveTools(steps: ReadonlyArray<any>): string[] {
  const discovered = new Set<ToolDomain>();
  for (const step of steps) {
    const calls =
      step?.toolCalls ??
      (Array.isArray(step?.content)
        ? step.content.filter((c: any) => c?.type === "tool-call")
        : []);
    for (const call of calls) {
      const name = call.toolName ?? call.name;
      if (name !== META_TOOL_NAME) continue;
      const input = call.input ?? call.args ?? {};
      const domain = (input as { domain?: ToolDomain }).domain;
      if (domain && domain in DOMAIN_TOOLS) discovered.add(domain);
    }
  }

  const active: string[] = [META_TOOL_NAME];
  for (const domain of discovered) {
    active.push(...DOMAIN_TOOLS[domain]);
  }
  if (process.env.AGENT_DEBUG) {
    console.log(
      `[agent] step ${steps.length}: discovered=[${[...discovered].join(
        ","
      )}] active=[${active.join(",")}]`
    );
  }
  return active;
}

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  resetCollectors();

  const { text } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: buildMessages(request),
    tools: allTools,
    stopWhen: stepCountIs(25),
    prepareStep: ({ steps }) => ({
      activeTools: computeActiveTools(steps) as any,
    }),
  });

  return {
    response: text,
    services_called: getServicesCalled(),
    traces: getTraces(),
    cards: [],
  };
}

const encoder = new TextEncoder();

function formatSSE(event: ChatStreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export function chatStream(request: ChatRequest): ReadableStream<Uint8Array> {
  resetCollectors();

  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: buildMessages(request),
    tools: allTools,
    stopWhen: stepCountIs(25),
    prepareStep: ({ steps }) => ({
      activeTools: computeActiveTools(steps) as any,
    }),
    onError: ({ error }) => {
      console.error("[agent] streamText error:", error);
    },
  });

  let textBlockCounter = 0;

  const transform = new TransformStream<any, Uint8Array>({
    transform(chunk, controller) {
      switch (chunk.type) {
        case "start-step":
          controller.enqueue(formatSSE({ type: "step-start" }));
          break;

        case "text-start": {
          const id = chunk.id ?? `t-${++textBlockCounter}`;
          controller.enqueue(formatSSE({ type: "text-start", id }));
          break;
        }

        case "text-delta": {
          // AI SDK v6 emits the incremental chunk as either `text` or `delta`
          // depending on provider/version; handle both.
          const text: string = chunk.text ?? chunk.delta ?? "";
          const id: string = chunk.id ?? `t-${textBlockCounter || 1}`;
          if (text) {
            controller.enqueue(formatSSE({ type: "text-delta", id, text }));
          }
          break;
        }

        case "text-end": {
          const id: string = chunk.id ?? `t-${textBlockCounter || 1}`;
          controller.enqueue(formatSSE({ type: "text-end", id }));
          break;
        }

        case "tool-call": {
          controller.enqueue(
            formatSSE({
              type: "tool-call",
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              input: chunk.input ?? chunk.args ?? {},
            })
          );
          break;
        }

        case "tool-result": {
          const output = chunk.output ?? chunk.result;
          controller.enqueue(
            formatSSE({
              type: "tool-result",
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              output,
            })
          );
          const card = takeCardForToolCallId(chunk.toolCallId);
          if (card) {
            controller.enqueue(
              formatSSE({
                type: "card",
                toolCallId: chunk.toolCallId,
                card,
              })
            );
          }
          break;
        }

        case "finish-step":
          controller.enqueue(formatSSE({ type: "step-finish" }));
          break;

        case "finish":
          controller.enqueue(
            formatSSE({
              type: "done",
              services_called: getServicesCalled(),
              traces: getTraces(),
            })
          );
          break;

        case "error":
          controller.enqueue(
            formatSSE({
              type: "error",
              message: chunk.error?.message ?? String(chunk.error ?? "Unknown error"),
            })
          );
          break;
      }
    },
  });

  return result.fullStream.pipeThrough(transform);
}
