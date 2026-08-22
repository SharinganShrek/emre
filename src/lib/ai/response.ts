import "server-only";
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
