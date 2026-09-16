import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AiPermissionError } from "./permissions";
import { AI_CORS_HEADERS } from "./key";

function withCors(init?: ResponseInit): ResponseInit {
  return {
    ...init,
    headers: {
      ...AI_CORS_HEADERS,
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  };
}

export function aiOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, withCors(init));
}

/**
 * Custom GPT Actions treat non-2xx as ClientResponseError and hide the body.
 * Keep HTTP 200 and put the real code in `http_status` so the model can read it.
 */
export function aiError(message: string, status = 400, extra?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      details: extra ?? null,
      http_status: status,
      data: extra ?? null,
    },
    withCors({ status: 200 }),
  );
}

function supabaseErrorMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const row = err as { code?: string; message?: string };
  if (typeof row.message !== "string") return null;

  if (row.code === "42P01") {
    return 'Database table missing. Run supabase/sat_vocab_schema.sql in Supabase SQL Editor.';
  }
  if (row.code === "23505") {
    return "Duplicate record conflict while saving progress.";
  }
  return row.message;
}

/** Convert thrown errors into a consistent JSON response. */
export function aiCatch(err: unknown) {
  if (err instanceof AiPermissionError) {
    return aiError(err.message, err.status);
  }
  if (err instanceof ZodError) {
    return aiError("Validation failed.", 422, err.flatten());
  }
  if (err instanceof SyntaxError) {
    return aiError("Request body must be valid JSON.", 400);
  }

  const dbMessage = supabaseErrorMessage(err);
  if (dbMessage) {
    console.error("[ai] database error", err);
    return aiError(dbMessage, 503);
  }

  console.error("[ai] unexpected error", err);
  return aiError("Internal server error.", 500);
}
