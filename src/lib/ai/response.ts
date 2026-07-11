import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AiPermissionError } from "./permissions";

export function aiOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function aiError(message: string, status = 400, extra?: unknown) {
  return NextResponse.json(
    { ok: false, error: message, details: extra ?? null },
    { status },
  );
}

/** Convert thrown errors into a consistent JSON response. */
export function aiCatch(err: unknown) {
  if (err instanceof AiPermissionError) {
    return aiError(err.message, err.status);
  }
  if (err instanceof ZodError) {
    return aiError("Validation failed.", 422, err.flatten());
  }
  console.error("[ai] unexpected error", err);
  return aiError("Internal server error.", 500);
}
