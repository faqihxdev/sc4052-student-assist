import { Hono } from "hono";
import type { ChatRequest } from "@studentassist/shared";
import { chat, chatStream } from "../orchestrator/orchestrator";
import { AppError } from "../lib/errors";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json<ChatRequest>();

  if (!body.message || typeof body.message !== "string") {
    return c.json(
      { error: "BadRequest", message: "\"message\" field is required", statusCode: 400 },
      400
    );
  }

  const wantsStream =
    c.req.header("accept")?.includes("text/event-stream") ||
    c.req.query("stream") === "true";

  if (wantsStream) {
    try {
      const stream = chatStream(body);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (err: any) {
      return c.json(
        { error: "ChatError", message: err.message ?? "Stream failed", statusCode: 500 },
        500
      );
    }
  }

  try {
    const result = await chat(body);
    return c.json(result);
  } catch (err: any) {
    if (err instanceof AppError) throw err;

    const message = err.message ?? "Chat request failed";
    console.error("Chat error:", message);
    return c.json(
      { error: "ChatError", message, statusCode: 500 },
      500
    );
  }
});

export default app;
