import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHubUserId } from "@/lib/access";
import { questionContentHash } from "./hash";
import { parseResultsReport } from "./parse-report";
import { scoreAttempt } from "./score";
import seedFile from "./seed-rw-1.json";
import type {
  SatAnswerMap,
  SatAttemptStatus,
  SatFlagMap,
  SatModules,
  SatPracticeAttempt,
  SatPracticeAttemptSummary,
  SatPracticeSettings,
  SatQuestion,
  SatSection,
  SatTimingMap,
} from "./types";
import { SECTION_META } from "./types";

const seedJson = seedFile as { report: string };

export const SEED_RW_ATTEMPT_ID = "c48f0054-2026-4000-8000-000000000001";

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function secretsMatch(provided: string, storedHash: string | null | undefined) {
  if (!provided || !storedHash) return false;
  const hashed = hashSecret(provided);
  if (hashed.length !== storedHash.length) return false;
  return timingSafeEqual(Buffer.from(hashed), Buffer.from(storedHash));
}

export function newSecret(prefix: string) {
  return `${prefix}${randomBytes(24).toString("base64url")}`;
}

function asAttempt(row: Record<string, unknown>): SatPracticeAttempt {
  const modules = (row.modules as SatModules) || { m1: [], m2: [] };
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    section: row.section === "math" ? "math" : "rw",
    title: String(row.title || ""),
    status: (row.status as SatAttemptStatus) || "ready",
    include_timing_in_report: row.include_timing_in_report !== false,
    source_html: (row.source_html as string | null) ?? null,
    modules: {
      m1: Array.isArray(modules.m1) ? modules.m1 : [],
      m2: Array.isArray(modules.m2) ? modules.m2 : [],
    },
    answers: (row.answers as SatAnswerMap) || {},
    flagged: (row.flagged as SatFlagMap) || {},
    seconds_spent: (row.seconds_spent as SatTimingMap) || {},
    module1_seconds_left: (row.module1_seconds_left as number | null) ?? null,
    module2_seconds_left: (row.module2_seconds_left as number | null) ?? null,
    raw_correct: (row.raw_correct as number | null) ?? null,
    raw_total: (row.raw_total as number | null) ?? null,
    scaled_estimated: (row.scaled_estimated as number | null) ?? null,
    domain_stats: (row.domain_stats as SatPracticeAttempt["domain_stats"]) ?? null,
    started_at: String(row.started_at || row.created_at),
    module1_completed_at: (row.module1_completed_at as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toSummary(row: Record<string, unknown>): SatPracticeAttemptSummary {
  const attempt = asAttempt(row);
  const { source_html: _h, modules, answers: _a, flagged: _f, seconds_spent: _s, ...rest } =
    attempt;
  return {
    ...rest,
    has_html: Boolean(row.has_html) || Boolean(row.source_html),
    question_count:
      attempt.raw_total ||
      (modules.m1?.length || 0) + (modules.m2?.length || 0) ||
      SECTION_META[attempt.section].questionsPerModule * 2,
  };
}

const LIST_COLS =
  "id,user_id,section,title,status,include_timing_in_report,has_html,raw_correct,raw_total,scaled_estimated,domain_stats,started_at,module1_completed_at,completed_at,created_at,updated_at";

function throwIfError(error: { message?: string; code?: string } | null) {
  if (!error) return;
  throw new Error(
    error.code === "42P01"
      ? "Database table missing. Run supabase/sat_practice_schema.sql in the Supabase SQL Editor."
      : error.message || "Supabase request failed",
  );
}

export async function ensureSettings(
  supabase: SupabaseClient,
  userId = getHubUserId(),
) {
  const existing = await supabase
    .from("sat_practice_settings")
    .select("user_id,ingest_token_hash,used_external_ids,used_content_hashes")
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(existing.error);
  if (existing.data) return existing.data;
  const inserted = await supabase
    .from("sat_practice_settings")
    .insert({
      user_id: userId,
      used_external_ids: [],
      used_content_hashes: [],
    })
    .select("user_id,ingest_token_hash,used_external_ids,used_content_hashes")
    .single();
  if (inserted.error) {
    if (inserted.error.code === "23505") return ensureSettings(supabase, userId);
    throwIfError(inserted.error);
  }
  return inserted.data;
}

function buildSeedAttempt(userId: string): SatPracticeAttempt {
  const parsed = parseResultsReport(seedJson.report, "rw");
  const now = new Date().toISOString();
  return {
    id: SEED_RW_ATTEMPT_ID,
    user_id: userId,
    section: "rw",
    title: "R&W MOCK 1",
    status: "completed",
    include_timing_in_report: false,
    source_html: null,
    modules: parsed.modules,
    answers: parsed.answers,
    flagged: {},
    seconds_spent: {},
    raw_correct: parsed.raw_correct,
    raw_total: parsed.raw_total,
    scaled_estimated: parsed.scaled_estimated,
    domain_stats: parsed.domain_stats,
    started_at: now,
    module1_completed_at: now,
    completed_at: now,
    created_at: now,
    updated_at: now,
  };
}

export function seedContentHashes() {
  const parsed = parseResultsReport(seedJson.report, "rw");
  return [...parsed.modules.m1, ...parsed.modules.m2].map((q) =>
    questionContentHash(q),
  );
}

export async function ensureSeedAttempt(
  supabase: SupabaseClient,
  userId = getHubUserId(),
) {
  try {
    const existing = await supabase
      .from("sat_practice_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("id", SEED_RW_ATTEMPT_ID)
      .maybeSingle();
    throwIfError(existing.error);
    if (existing.data) return;

    const seed = buildSeedAttempt(userId);
    const inserted = await supabase.from("sat_practice_attempts").insert({
      id: seed.id,
      user_id: userId,
      section: seed.section,
      title: seed.title,
      status: seed.status,
      include_timing_in_report: seed.include_timing_in_report,
      has_html: false,
      modules: seed.modules,
      answers: seed.answers,
      flagged: seed.flagged,
      seconds_spent: seed.seconds_spent,
      raw_correct: seed.raw_correct,
      raw_total: seed.raw_total,
      scaled_estimated: seed.scaled_estimated,
      domain_stats: seed.domain_stats,
      started_at: seed.started_at,
      module1_completed_at: seed.module1_completed_at,
      completed_at: seed.completed_at,
    });
    if (inserted.error && inserted.error.code !== "23505") {
      throwIfError(inserted.error);
    }

    const settings = await ensureSettings(supabase, userId);
    const hashes = new Set<string>([
      ...(((settings.used_content_hashes as string[]) || []).map(String)),
      ...seedContentHashes(),
    ]);
    await supabase
      .from("sat_practice_settings")
      .update({ used_content_hashes: [...hashes] })
      .eq("user_id", userId);
  } catch (err) {
    console.error("[sat-practice] seed attempt skipped", err);
  }
}

export async function listAttempts(
  supabase: SupabaseClient,
  userId = getHubUserId(),
): Promise<SatPracticeAttemptSummary[]> {
  await ensureSeedAttempt(supabase, userId);
  const { data, error } = await supabase
    .from("sat_practice_attempts")
    .select(LIST_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data || []).map((row) => toSummary(row as Record<string, unknown>));
}

export async function getAttempt(
  supabase: SupabaseClient,
  id: string,
  userId = getHubUserId(),
  opts?: { includeHtml?: boolean },
): Promise<SatPracticeAttempt | null> {
  await ensureSeedAttempt(supabase, userId);
  const { data, error } = await supabase
    .from("sat_practice_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  if (!data) return null;
  const row = { ...(data as Record<string, unknown>) };
  if (!opts?.includeHtml) delete row.source_html;
  return asAttempt(row);
}

export async function getAttemptHtml(
  supabase: SupabaseClient,
  id: string,
  userId = getHubUserId(),
) {
  const { data, error } = await supabase
    .from("sat_practice_attempts")
    .select("source_html,title,section")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data as { source_html: string | null; title: string; section: SatSection } | null;
}

export async function patchAttempt(
  supabase: SupabaseClient,
  id: string,
  patch: { include_timing_in_report?: boolean },
  userId = getHubUserId(),
) {
  const { data, error } = await supabase
    .from("sat_practice_attempts")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id)
    .select(LIST_COLS)
    .single();
  throwIfError(error);
  return toSummary(data as Record<string, unknown>);
}

export async function rotateIngestToken(
  supabase: SupabaseClient,
  userId = getHubUserId(),
) {
  await ensureSettings(supabase, userId);
  const token = newSecret("satp_");
  const { error } = await supabase
    .from("sat_practice_settings")
    .update({ ingest_token_hash: hashSecret(token) })
    .eq("user_id", userId);
  throwIfError(error);
  return token;
}

export async function settingsSummary(
  supabase: SupabaseClient,
  userId = getHubUserId(),
): Promise<SatPracticeSettings> {
  await ensureSeedAttempt(supabase, userId);
  const row = await ensureSettings(supabase, userId);
  const ids = (row.used_external_ids as string[]) || [];
  const hashes = (row.used_content_hashes as string[]) || [];
  return {
    has_ingest_token: Boolean(row.ingest_token_hash),
    used_external_id_count: ids.length,
    used_content_hash_count: hashes.length,
  };
}

export async function verifyIngestToken(
  supabase: SupabaseClient,
  token: string,
  userId = getHubUserId(),
) {
  const row = await ensureSettings(supabase, userId);
  return secretsMatch(token, row.ingest_token_hash as string | null);
}

export async function usedQuestionLists(
  supabase: SupabaseClient,
  userId = getHubUserId(),
) {
  await ensureSeedAttempt(supabase, userId);
  const row = await ensureSettings(supabase, userId);
  return {
    external_ids: ((row.used_external_ids as string[]) || []).map(String),
    content_hashes: ((row.used_content_hashes as string[]) || []).map(String),
  };
}

export async function addUsedQuestions(
  supabase: SupabaseClient,
  add: { external_ids?: string[]; content_hashes?: string[] },
  userId = getHubUserId(),
) {
  const current = await usedQuestionLists(supabase, userId);
  const ids = new Set(current.external_ids);
  const hashes = new Set(current.content_hashes);
  for (const id of add.external_ids || []) if (id) ids.add(String(id));
  for (const h of add.content_hashes || []) if (h) hashes.add(String(h));
  const nextIds = [...ids].slice(-4000);
  const nextHashes = [...hashes].slice(-4000);
  const { error } = await supabase
    .from("sat_practice_settings")
    .update({
      used_external_ids: nextIds,
      used_content_hashes: nextHashes,
    })
    .eq("user_id", userId);
  throwIfError(error);
  return { external_ids: nextIds, content_hashes: nextHashes };
}

function nextTitle(
  existing: { section: string; title: string }[],
  section: SatSection,
) {
  const prefix = section === "math" ? "MATH MOCK" : "R&W MOCK";
  let max = 0;
  for (const row of existing) {
    if (row.section !== section) continue;
    const n = Number(String(row.title).match(/(\d+)\s*$/)?.[1] || 0);
    if (n > max) max = n;
  }
  return `${prefix} ${max + 1}`;
}

export async function createAttemptFromIngest(
  supabase: SupabaseClient,
  body: {
    section: SatSection;
    m1: SatQuestion[];
    m2: SatQuestion[];
    html?: string;
    stamp?: string;
  },
  userId = getHubUserId(),
) {
  const listed = await supabase
    .from("sat_practice_attempts")
    .select("section,title")
    .eq("user_id", userId);
  throwIfError(listed.error);
  const title = nextTitle(listed.data || [], body.section);
  const moduleToken = newSecret("mod_");
  const modules: SatModules = { m1: body.m1 || [], m2: body.m2 || [] };
  const { data, error } = await supabase
    .from("sat_practice_attempts")
    .insert({
      user_id: userId,
      section: body.section,
      title,
      status: "ready",
      include_timing_in_report: true,
      has_html: Boolean(body.html),
      module_token_hash: hashSecret(moduleToken),
      source_html: body.html || null,
      modules,
      answers: {},
      flagged: {},
      seconds_spent: {},
      started_at: new Date().toISOString(),
    })
    .select("id,title,section,status,created_at")
    .single();
  throwIfError(error);

  const external_ids = [...modules.m1, ...modules.m2]
    .map((q) => q.externalId)
    .filter((id): id is string => Boolean(id));
  const content_hashes = [...modules.m1, ...modules.m2].map((q) =>
    questionContentHash(q),
  );
  await addUsedQuestions(supabase, { external_ids, content_hashes }, userId);

  return {
    attempt: data,
    module_token: moduleToken,
  };
}

export async function saveAttemptHtml(
  supabase: SupabaseClient,
  attemptId: string,
  html: string,
  userId = getHubUserId(),
) {
  const { error } = await supabase
    .from("sat_practice_attempts")
    .update({ source_html: html, has_html: Boolean(html) })
    .eq("user_id", userId)
    .eq("id", attemptId);
  throwIfError(error);
}

export async function completeModule(
  supabase: SupabaseClient,
  input: {
    attemptId: string;
    moduleToken: string;
    module: 1 | 2;
    answers: SatAnswerMap;
    flagged?: SatFlagMap;
    seconds_spent?: SatTimingMap;
    seconds_left?: number | null;
  },
  userId = getHubUserId(),
) {
  const { data, error } = await supabase
    .from("sat_practice_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", input.attemptId)
    .maybeSingle();
  throwIfError(error);
  if (!data) return { ok: false as const, error: "Attempt not found" };
  if (!secretsMatch(input.moduleToken, data.module_token_hash as string | null)) {
    return { ok: false as const, error: "Invalid module token" };
  }

  const attempt = asAttempt(data as Record<string, unknown>);
  const answers = { ...attempt.answers, ...input.answers };
  const flagged = { ...attempt.flagged, ...(input.flagged || {}) };
  const seconds_spent = {
    ...attempt.seconds_spent,
    ...(input.seconds_spent || {}),
  };
  const now = new Date().toISOString();
  let status = attempt.status;
  const patch: Record<string, unknown> = {
    answers,
    flagged,
    seconds_spent,
  };
  if (input.module === 1) {
    patch.module1_seconds_left = input.seconds_left ?? null;
    patch.module1_completed_at = now;
    if (status === "ready") status = "module1_done";
  } else {
    patch.module2_seconds_left = input.seconds_left ?? null;
    const scored = scoreAttempt(attempt.section, attempt.modules, answers);
    Object.assign(patch, scored);
    patch.completed_at = now;
    status = "completed";
  }
  patch.status = status;

  const updated = await supabase
    .from("sat_practice_attempts")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", input.attemptId)
    .select(LIST_COLS)
    .single();
  throwIfError(updated.error);
  return { ok: true as const, attempt: toSummary(updated.data as Record<string, unknown>) };
}

export async function allCompletedAttempts(
  supabase: SupabaseClient,
  userId = getHubUserId(),
) {
  await ensureSeedAttempt(supabase, userId);
  const { data, error } = await supabase
    .from("sat_practice_attempts")
    .select(
      "id,user_id,section,title,status,include_timing_in_report,modules,answers,flagged,seconds_spent,raw_correct,raw_total,scaled_estimated,domain_stats,started_at,completed_at,created_at,updated_at,module1_completed_at,module1_seconds_left,module2_seconds_left",
    )
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });
  throwIfError(error);
  return (data || []).map((row) => asAttempt(row as Record<string, unknown>));
}
