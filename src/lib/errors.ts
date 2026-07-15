import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "./logger";
import { captureError } from "./sentry";

/** Application error with an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = "bad_request",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = (msg = "Not authenticated") => new AppError(msg, 401, "unauthorized");
export const forbidden = (msg = "Not allowed") => new AppError(msg, 403, "forbidden");
export const notFound = (msg = "Not found") => new AppError(msg, 404, "not_found");

/** Shared JSON error envelope for /api/v1 route handlers. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid input", issues: err.issues } },
      { status: 422 },
    );
  }
  // Capture unhandled errors to Sentry
  logger.error({ err }, "unhandled API error");
  if (err instanceof Error) {
    captureError(err, { context: "api_handler" }, "error");
  } else {
    captureError(String(err), { context: "api_handler" }, "error");
  }
  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong" } },
    { status: 500 },
  );
}
