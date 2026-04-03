import type { Context } from "hono";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function handleError(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(
      { error: err.name, message: err.message, statusCode: err.statusCode },
      err.statusCode as 400
    );
  }

  console.error("Unhandled error:", err);
  return c.json(
    { error: "InternalServerError", message: "Something went wrong", statusCode: 500 },
    500
  );
}
