import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHubUserId } from "@/lib/access";
import { questionContentHash } from "./hash";
import {
  mergeQuestionBank,
  modulesNeedChoices,
  normalizeAnswerMap,
  normalizeSectionModules,
  parseMockHtml,
} from "./parse-mock-html";
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
import { allQuestions, SECTION_META } from "./types";

const seedJson = seedFile as {
  report: string;
  modules?: SatModules;
};

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

function asSatSection(value: unknown): SatSection {
  if (value === "math" || value === "full") return value;
  return "rw";
}

function asAttempt(row: Record<string, unknown>): SatPracticeAttempt {
  const rawModules = (row.modules as SatModules) || { m1: [], m2: [] };
  const fromHtml = parseMockHtml(String(row.source_html || ""));
  const modules = mergeQuestionBank(
    {
      m1: Array.isArray(rawModules.m1) ? rawModules.m1 : [],
      m2: Array.isArray(rawModules.m2) ? rawModules.m2 : [],
      rw: rawModules.rw,
      math: rawModules.math,
    },
    fromHtml,
  );
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    section: asSatSection(row.section),
    source: row.source === "bluebook" ? "bluebook" : "qbank",
    roster_id: (row.roster_id as string | null) ?? null,
    title: String(row.title || ""),
    status: (row.status as SatAttemptStatus) || "ready",
    include_timing_in_report: row.include_timing_in_report !== false,
    source_html: (row.source_html as string | null) ?? null,
    modules,
    answers: (row.answers as SatAnswerMap) || {},
    flagged: (row.flagged as SatFlagMap) || {},
    seconds_spent: (row.seconds_spent as SatTimingMap) || {},
    module1_seconds_left: (row.module1_seconds_left as number | null) ?? null,
    module2_seconds_left: (row.module2_seconds_left as number | null) ?? null,
    raw_correct: (row.raw_correct as number | null) ?? null,
    raw_total: (row.raw_total as number | null) ?? null,
    scaled_estimated: (row.scaled_estimated as number | null) ?? null,
    official_total: (row.official_total as number | null) ?? null,
    official_rw: (row.official_rw as number | null) ?? null,
    official_math: (row.official_math as number | null) ?? null,
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
      allQuestions(modules).length ||
      (attempt.section === "full"
        ? 98
        : SECTION_META[attempt.section].questionsPerModule * 2),
  };
}

const LIST_COLS =
  "id,user_id,section,source,roster_id,title,status,include_timing_in_report,has_html,raw_correct,raw_total,scaled_estimated,official_total,official_rw,official_math,domain_stats,started_at,module1_completed_at,completed_at,created_at,updated_at";

function throwIfError(
  error: { message?: string; code?: string } | null,
): asserts error is null {
  if (!error) return;
  throw new Error(
    error.code === "42P01" || error.code === "42703"
      ? "Database table missing columns. Run supabase/sat_practice_schema.sql in the Supabase SQL Editor."
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
  if (!inserted.data) {
    throw new Error("Failed to create SAT practice settings");
  }
  return inserted.data;
}

function seedModules() {
  const parsed = parseResultsReport(seedJson.report, "rw");
  return mergeQuestionBank(parsed.modules, seedJson.modules || null);
}

function buildSeedAttempt(userId: string): SatPracticeAttempt {
  const parsed = parseResultsReport(seedJson.report, "rw");
  const now = new Date().toISOString();
  return {
    id: SEED_RW_ATTEMPT_ID,
    user_id: userId,
    section: "rw",
    source: "qbank",
    roster_id: null,
    title: "R&W MOCK 1",
    status: "completed",
    include_timing_in_report: false,
    source_html: null,
    modules: seedModules(),
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
  const modules = seedModules();
  return [...modules.m1, ...modules.m2].map((q) => questionContentHash(q));
}

function seedExternalIds() {
  const modules = seedModules();
  return [...modules.m1, ...modules.m2]
    .map((q) => q.externalId)
    .filter((id): id is string => Boolean(id));
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
    if (existing.data) {
      await repairSeedChoices(supabase, userId);
      return;
    }

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
    const ids = new Set<string>([
      ...(((settings.used_external_ids as string[]) || []).map(String)),
      ...seedExternalIds(),
    ]);
    await supabase
      .from("sat_practice_settings")
      .update({
        used_content_hashes: [...hashes],
        used_external_ids: [...ids],
      })
      .eq("user_id", userId);
  } catch (err) {
    console.error("[sat-practice] seed attempt skipped", err);
  }
}

async function repairSeedChoices(
  supabase: SupabaseClient,
  userId: string,
) {
  const existing = await supabase
    .from("sat_practice_attempts")
    .select("modules")
    .eq("user_id", userId)
    .eq("id", SEED_RW_ATTEMPT_ID)
    .maybeSingle();
  throwIfError(existing.error);
  if (!modulesNeedChoices(existing.data?.modules as SatModules | undefined)) return;
  const seed = buildSeedAttempt(userId);
  const { error } = await supabase
    .from("sat_practice_attempts")
    .update({ modules: seed.modules })
    .eq("user_id", userId)
    .eq("id", SEED_RW_ATTEMPT_ID);
  throwIfError(error);
  const settings = await ensureSettings(supabase, userId);
  const hashes = new Set<string>([
    ...(((settings.used_content_hashes as string[]) || []).map(String)),
    ...seedContentHashes(),
  ]);
  const ids = new Set<string>([
    ...(((settings.used_external_ids as string[]) || []).map(String)),
    ...seedExternalIds(),
  ]);
  await supabase
    .from("sat_practice_settings")
    .update({
      used_content_hashes: [...hashes],
      used_external_ids: [...ids],
    })
    .eq("user_id", userId);
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
  const prefix =
    section === "math" ? "MATH MOCK" : section === "full" ? "Practice" : "R&W MOCK";
  let max = 0;
  for (const row of existing) {
    if (row.section !== section) continue;
    const n = Number(String(row.title).match(/(\d+)\s*$/)?.[1] || 0);
    if (n > max) max = n;
  }
  return `${prefix} ${max + 1}`;
}

function usedFromModules(modules: SatModules) {
  const questions = allQuestions(modules);
  return {
    external_ids: questions
      .map((q) => q.externalId)
      .filter((id): id is string => Boolean(id)),
    content_hashes: questions.map((q) => questionContentHash(q)),
  };
}

export async function upsertBluebookAttempt(
  supabase: SupabaseClient,
  body: {
    roster_id: string;
    title?: string;
    started_at?: string;
    official_total?: number | null;
    official_rw?: number | null;
    official_math?: number | null;
    modules?: unknown;
    answers?: unknown;
  },
  userId = getHubUserId(),
) {
  const rosterId = String(body.roster_id || "").trim();
  if (!rosterId) throw new Error("roster_id is required");
  const modules: SatModules = {
    m1: [],
    m2: [],
    rw: normalizeSectionModules(
      (body.modules as SatModules | undefined)?.rw ?? body.modules,
    ),
    math: normalizeSectionModules((body.modules as SatModules | undefined)?.math),
  };
  if (!allQuestions(modules).length) {
    throw new Error("Bluebook import needs questions");
  }
  const answers = normalizeAnswerMap(body.answers);
  const scored = scoreAttempt("full", modules, answers);
  const officialTotal =
    body.official_total == null ? null : Number(body.official_total);
  const officialRw = body.official_rw == null ? null : Number(body.official_rw);
  const officialMath = body.official_math == null ? null : Number(body.official_math);
  const title = String(body.title || "").trim() || nextTitle(
    ((await supabase
      .from("sat_practice_attempts")
      .select("section,title")
      .eq("user_id", userId)).data || []) as { section: string; title: string }[],
    "full",
  );
  let startedAt = new Date().toISOString();
  if (body.started_at) {
    const parsed = new Date(body.started_at);
    if (!Number.isNaN(parsed.getTime())) startedAt = parsed.toISOString();
  }
  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    section: "full" as const,
    source: "bluebook" as const,
    roster_id: rosterId,
    title,
    status: "completed" as const,
    include_timing_in_report: false,
    has_html: false,
    modules,
    answers,
    flagged: {},
    seconds_spent: {},
    raw_correct: scored.raw_correct,
    raw_total: scored.raw_total,
    scaled_estimated: officialTotal ?? scored.scaled_estimated,
    official_total: officialTotal,
    official_rw: officialRw,
    official_math: officialMath,
    domain_stats: scored.domain_stats,
    started_at: startedAt,
    module1_completed_at: startedAt,
    completed_at: now,
  };

  const existing = await supabase
    .from("sat_practice_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("roster_id", rosterId)
    .maybeSingle();
  throwIfError(existing.error);

  let saved;
  if (existing.data?.id) {
    saved = await supabase
      .from("sat_practice_attempts")
      .update(row)
      .eq("user_id", userId)
      .eq("id", existing.data.id)
      .select(LIST_COLS)
      .single();
  } else {
    saved = await supabase
      .from("sat_practice_attempts")
      .insert(row)
      .select(LIST_COLS)
      .single();
  }
  throwIfError(saved.error);
  await addUsedQuestions(supabase, usedFromModules(modules), userId);
  return toSummary(saved.data as Record<string, unknown>);
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
  const fromHtml = parseMockHtml(body.html || "");
  const modules: SatModules = mergeQuestionBank(
    { m1: body.m1 || [], m2: body.m2 || [] },
    fromHtml,
  );
  const { data, error } = await supabase
    .from("sat_practice_attempts")
    .insert({
      user_id: userId,
      section: body.section,
      title,
      status: "ready",
      include_timing_in_report: true,
      has_html: Boolean(body.html),
      source: "qbank",
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
  if (!data) throw new Error("Failed to create SAT practice attempt");

  const { external_ids, content_hashes } = usedFromModules(modules);
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
  const current = await supabase
    .from("sat_practice_attempts")
    .select("modules")
    .eq("user_id", userId)
    .eq("id", attemptId)
    .maybeSingle();
  throwIfError(current.error);
  const merged = mergeQuestionBank(
    (current.data?.modules as SatModules) || { m1: [], m2: [] },
    parseMockHtml(html),
  );
  const { error } = await supabase
    .from("sat_practice_attempts")
    .update({
      source_html: html,
      has_html: Boolean(html),
      modules: merged,
    })
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
      "id,user_id,section,source,roster_id,title,status,include_timing_in_report,modules,answers,flagged,seconds_spent,raw_correct,raw_total,scaled_estimated,official_total,official_rw,official_math,domain_stats,started_at,completed_at,created_at,updated_at,module1_completed_at,module1_seconds_left,module2_seconds_left",
    )
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });
  throwIfError(error);
  return (data || []).map((row) => asAttempt(row as Record<string, unknown>));
}
