import { generateText, streamText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { config } from "../lib/config";
import type { ChatRequest, ChatResponse, ChatStreamEvent } from "@studentassist/shared";
import {
  allTools,
  resetCollectors,
  getTraces,
  getCards,
  getServicesCalled,
} from "./tools";

const SYSTEM_PROMPT = `You are StudentAssist, a personal assistant for university students.
You have access to the following services via tools:

- **Calendar**: View today's schedule, list events by date range, find free time slots, create events
- **Tasks**: List, create, and update tasks with priorities and due dates
- **GitHub**: List repos, view repo activity (commits, PRs, issues), see assigned issues
- **News**: Get top HackerNews stories or search by keyword
- **Weather**: Get current weather or 5-day forecast for any city

Guidelines:
- When the user asks a broad question like "what's my day looking like?" or "give me a morning briefing", call multiple tools in parallel (calendar, tasks, weather) to give a comprehensive answer.
- Always use tools to fetch real data — never make up information.
- Be concise but helpful. Format dates and times naturally (e.g., "3:00 PM" not "15:00:00").
- When presenting data, organize it clearly with sections if multiple services are involved.
- If a tool returns an error (e.g. service not configured), mention it briefly and continue with other available data.
- For task creation, confirm what was created. For updates, confirm what changed.
- Be action-oriented: when the user asks you to create a task, event, etc., do it immediately using sensible defaults (medium priority, no due date) rather than asking for more details. Only ask for clarification if the request is truly ambiguous.
- For weather: omit the city parameter to use the user's default city. Only specify a city if the user explicitly mentions one.
- Today's date is ${new Date().toISOString().split("T")[0]}.`;

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

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  resetCollectors();

  const { text } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: buildMessages(request),
    tools: allTools,
    stopWhen: stepCountIs(5),
  });

  return {
    response: text,
    services_called: getServicesCalled(),
    traces: getTraces(),
    cards: getCards(),
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
    stopWhen: stepCountIs(5),
  });

  const transform = new TransformStream<any, Uint8Array>({
    transform(chunk, controller) {
      switch (chunk.type) {
        case "text-delta":
          controller.enqueue(formatSSE({ type: "text-delta", text: chunk.text }));
          break;
        case "tool-call":
          controller.enqueue(
            formatSSE({
              type: "tool-call",
              toolName: chunk.toolName,
              args: chunk.args,
            })
          );
          break;
        case "tool-result":
          controller.enqueue(
            formatSSE({
              type: "tool-result",
              toolName: chunk.toolName,
              result: chunk.result,
            })
          );
          break;
        case "finish":
          controller.enqueue(
            formatSSE({
              type: "done",
              services_called: getServicesCalled(),
              traces: getTraces(),
              cards: getCards(),
            })
          );
          break;
      }
    },
  });

  return result.fullStream.pipeThrough(transform);
}
