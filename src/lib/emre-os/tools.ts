import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { GET as healthGet } from "@/app/api/ai/health/route";
import { GET as todayGet } from "@/app/api/ai/summary/today/route";
import { GET as habitsGet } from "@/app/api/ai/habits/route";
import { PATCH as habitLogPatch } from "@/app/api/ai/habits/log/route";
import { GET as tasksGet, POST as tasksPost } from "@/app/api/ai/tasks/route";
import { GET as moviesGet, POST as moviesPost } from "@/app/api/ai/movies/route";
import { GET as journalRecentGet } from "@/app/api/ai/journal/recent/route";
import { POST as journalPost } from "@/app/api/ai/journal/route";
import { GET as analyticsGet } from "@/app/api/ai/analytics/last-30-days/route";
import {
  GET as vocabProgressGet,
  POST as vocabProgressPost,
} from "@/app/api/ai/sat-vocab/progress/route";
import { GET as vocabPlanGet } from "@/app/api/ai/sat-vocab/plan/route";
import { GET as vocabSessionGet } from "@/app/api/ai/sat-vocab/session/route";
import { GET as vocabThemesGet } from "@/app/api/ai/sat-vocab/themes/route";
import { GET as vocabWordsGet } from "@/app/api/ai/sat-vocab/words/route";
import { GET as vocabWeakGet } from "@/app/api/ai/sat-vocab/weak-words/route";
import { GET as counselingGet } from "@/app/api/ai/college-counseling/route";
import { POST as counselingWrite } from "@/app/api/ai/college-counseling/write/[op]/route";
import { GET as counselingPackGet } from "@/app/api/ai/college-counseling/context-pack/route";
import {
  GET as studySessionsGet,
  POST as studySessionsPost,
} from "@/app/api/ai/study/sessions/route";
import { GET as studyStatsGet } from "@/app/api/ai/study/stats/route";
import { GET as practiceSummaryGet } from "@/app/api/ai/sat-practice/summary/route";
import { GET as practiceAttemptsGet } from "@/app/api/ai/sat-practice/attempts/route";
import { GET as practiceReportGet } from "@/app/api/ai/sat-practice/report/route";
import { invokeAiRoute } from "@/lib/emre-os/invoke";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("YYYY-MM-DD");

const none = z.object({});

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError: boolean;
};

function tool(
  server: McpServer,
  name: string,
  title: string,
  description: string,
  inputSchema: z.ZodType,
  readOnly: boolean,
  run: (args: Record<string, unknown>) => Promise<ToolResult>,
) {
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema,
      annotations: { readOnlyHint: readOnly },
    },
    async (args) => run((args || {}) as Record<string, unknown>),
  );
}

export function registerEmreOsTools(server: McpServer) {
  tool(
    server,
    "getAiHealth",
    "AI connectivity check",
    "Public ping. ok is always true. Use before a live Emre OS read when a connection check is needed. Do not stop if authenticated is false.",
    none,
    true,
    () => invokeAiRoute(healthGet, "/api/ai/health", "GET"),
  );

  tool(
    server,
    "getTodaySummary",
    "Today snapshot",
    "Use for today's habit completion, tasks due or overdue, and today's journal entry.",
    none,
    true,
    () => invokeAiRoute(todayGet, "/api/ai/summary/today", "GET"),
  );

  tool(
    server,
    "listHabits",
    "List habits",
    "Use to list active habits and whether each is completed today.",
    none,
    true,
    () => invokeAiRoute(habitsGet, "/api/ai/habits", "GET"),
  );

  tool(
    server,
    "upsertHabitLog",
    "Mark habit complete",
    "Use when Emre asks to mark a habit complete or incomplete. Non-destructive upsert. Confirm unless he clearly asked to save.",
    z.object({
      habit_id: z.string().min(1),
      completed: z.boolean(),
      log_date: isoDate.optional(),
      note: z.string().max(500).optional(),
    }),
    false,
    (args) =>
      invokeAiRoute(habitLogPatch, "/api/ai/habits/log", "PATCH", { body: args }),
  );

  tool(
    server,
    "listTasks",
    "List tasks",
    "Use to list tasks. Optional status filter: todo, in_progress, done.",
    z.object({
      status: z.enum(["todo", "in_progress", "done"]).optional(),
    }),
    true,
    (args) =>
      invokeAiRoute(tasksGet, "/api/ai/tasks", "GET", { query: args }),
  );

  tool(
    server,
    "createTask",
    "Create a task",
    "Use when Emre asks to add a task. No delete. Confirm unless he clearly asked to save.",
    z.object({
      title: z.string().min(1).max(200),
      notes: z.string().max(2000).optional(),
      status: z.enum(["todo", "in_progress", "done"]).optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      due_date: isoDate.optional(),
      project: z.string().max(100).optional(),
    }),
    false,
    (args) => invokeAiRoute(tasksPost, "/api/ai/tasks", "POST", { body: args }),
  );

  tool(
    server,
    "listMovies",
    "List movies and anime",
    "Use to list movies, series, and anime.",
    none,
    true,
    () => invokeAiRoute(moviesGet, "/api/ai/movies", "GET"),
  );

  tool(
    server,
    "createMovie",
    "Add a movie or anime",
    "Use when Emre asks to add a movie, series, or anime. Confirm unless he clearly asked to save.",
    z.object({
      title: z.string().min(1).max(200),
      kind: z.enum(["anime", "movie", "series"]).optional(),
      status: z.enum(["planned", "watching", "watched"]).optional(),
      rating: z.number().min(0).max(10).optional(),
      review: z.string().max(2000).optional(),
      watched_date: isoDate.optional(),
      source: z.enum(["mal", "anilist"]).optional(),
      external_id: z.string().max(40).optional(),
      episodes: z.number().int().min(0).optional(),
      episodes_watched: z.number().int().min(0).optional(),
    }),
    false,
    (args) =>
      invokeAiRoute(moviesPost, "/api/ai/movies", "POST", { body: args }),
  );

  tool(
    server,
    "listRecentJournal",
    "Recent journal entries",
    "Use to read recent journal entries. limit is 1–30, default 7.",
    z.object({
      limit: z.number().int().min(1).max(30).optional(),
    }),
    true,
    (args) =>
      invokeAiRoute(journalRecentGet, "/api/ai/journal/recent", "GET", {
        query: args,
      }),
  );

  tool(
    server,
    "upsertJournal",
    "Save a journal entry",
    "Use when Emre asks to write today's journal. Upserts entry_date (default today). Confirm unless he clearly asked to save.",
    z.object({
      mood: z.number().int().min(1).max(5),
      content: z.string().min(1).max(5000),
      entry_date: isoDate.optional(),
    }),
    false,
    (args) =>
      invokeAiRoute(journalPost, "/api/ai/journal", "POST", { body: args }),
  );

  tool(
    server,
    "getLast30DaysAnalytics",
    "Last 30 days analytics",
    "Use for the last-30-days habit, study, journal, mood, and movies summary.",
    none,
    true,
    () =>
      invokeAiRoute(analyticsGet, "/api/ai/analytics/last-30-days", "GET"),
  );

  tool(
    server,
    "getSatVocabProgress",
    "SAT vocab progress",
    "Use first for SAT vocab study. Returns next_open, streak, and recent_results. Do not invent plan_ids or words.",
    none,
    true,
    () =>
      invokeAiRoute(vocabProgressGet, "/api/ai/sat-vocab/progress", "GET"),
  );

  tool(
    server,
    "updateSatVocabProgress",
    "Record SAT vocab progress",
    "Use for learn, test, rest, word_results, or send_test. Learn day needs learn and test. send_test queues an in-app mixed quiz. See skill payloads.md. Confirm unless Emre asked to save.",
    z.looseObject({
      action: z.enum(["learn", "test", "rest", "word_results", "send_test"]),
      plan_id: z.string().optional(),
      known_words: z.array(z.string()).optional(),
      drill: z
        .enum([
          "matching",
          "type_word",
          "type_definition",
          "multiple_choice",
          "mixed",
        ])
        .optional(),
      score: z.number().int().min(0).max(100).optional(),
      results: z
        .array(
          z.object({
            word: z.string(),
            correct: z.boolean(),
            chosen: z.string().optional(),
            expected: z.string().optional(),
          }),
        )
        .optional(),
      title: z.string().optional(),
      test: z
        .object({
          format: z.enum([
            "matching",
            "type_word",
            "type_definition",
            "multiple_choice",
            "mixed",
          ]),
          items: z.array(z.record(z.string(), z.unknown())).min(1).max(200),
        })
        .optional(),
    }),
    false,
    (args) =>
      invokeAiRoute(vocabProgressPost, "/api/ai/sat-vocab/progress", "POST", {
        body: args,
      }),
  );

  tool(
    server,
    "getSatVocabPlan",
    "SAT vocab 10-week plan",
    "Use for the plan outline. Word lists are omitted unless include_words is true. Prefer getSatVocabSession for cards.",
    z.object({
      week: z.number().int().min(1).max(10).optional(),
      include_words: z.boolean().optional(),
    }),
    true,
    (args) =>
      invokeAiRoute(vocabPlanGet, "/api/ai/sat-vocab/plan", "GET", {
        query: args,
      }),
  );

  tool(
    server,
    "getSatVocabSession",
    "SAT vocab session cards",
    "Use to teach or quiz one session. Omit plan_id for the next open session. detail=full to teach, compact to quiz.",
    z.object({
      plan_id: z.string().optional(),
      date: isoDate.optional(),
      session_num: z.number().int().min(1).max(50).optional(),
      detail: z.enum(["compact", "full"]).optional(),
    }),
    true,
    (args) =>
      invokeAiRoute(vocabSessionGet, "/api/ai/sat-vocab/session", "GET", {
        query: args,
      }),
  );

  tool(
    server,
    "getSatVocabThemes",
    "SAT vocab themes",
    "Use before listing words by theme. Returns the 25 themes in catalog order.",
    none,
    true,
    () => invokeAiRoute(vocabThemesGet, "/api/ai/sat-vocab/themes", "GET"),
  );

  tool(
    server,
    "getSatVocabWords",
    "Lookup SAT vocab words",
    "Use for one word, a search, or a theme page. limit max 40. detail=full for morphology and notes.",
    z.object({
      word: z.string().optional(),
      q: z.string().optional(),
      theme: z.string().optional(),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(40).optional(),
      detail: z.enum(["compact", "full"]).optional(),
    }),
    true,
    (args) =>
      invokeAiRoute(vocabWordsGet, "/api/ai/sat-vocab/words", "GET", {
        query: args,
      }),
  );

  tool(
    server,
    "getSatVocabWeakWords",
    "Weak SAT vocab words",
    "Use for words under 70% quiz accuracy and due reviews. limit max 40.",
    z.object({
      limit: z.number().int().min(1).max(40).optional(),
    }),
    true,
    (args) =>
      invokeAiRoute(vocabWeakGet, "/api/ai/sat-vocab/weak-words", "GET", {
        query: args,
      }),
  );

  tool(
    server,
    "getCollegeCounseling",
    "Read college counseling",
    "Use before any counseling edit. Returns the stored document. Never invent ids or activity text.",
    none,
    true,
    () => invokeAiRoute(counselingGet, "/api/ai/college-counseling", "GET"),
  );

  tool(
    server,
    "updateCollegeProfile",
    "Update college profile",
    "Use to change profile fields only. Send patch with the changed fields. Testing and APs go in patch.testing. Empty strings are ignored.",
    z.object({
      patch: z.record(z.string(), z.unknown()),
    }),
    false,
    (args) =>
      invokeAiRoute(counselingWrite, "/api/ai/college-counseling/write/profile", "POST", {
        body: args,
        params: { op: "profile" },
      }),
  );

  tool(
    server,
    "writeCollegeItem",
    "Add, update, or delete a counseling card",
    "Use for activities, research, schools, recommendations, testing, and academic records. Send action, section, and id. item and patch are JSON strings, not nested objects. After a write, tell Emre to tap Reload from server.",
    z.object({
      action: z.enum(["add", "update", "delete"]),
      section: z.enum([
        "activities",
        "research",
        "schools",
        "recommendations",
        "testing",
        "academic_records",
      ]),
      id: z.string().optional(),
      item: z.string().optional(),
      patch: z.string().optional(),
      notes: z.string().optional(),
      school_name: z.string().optional(),
      program: z.string().optional(),
      title: z.string().optional(),
      expanded_description: z.string().optional(),
      common_app_description: z.string().optional(),
      group: z.enum(["us_need_blind", "europe_main"]).optional(),
    }),
    false,
    (args) =>
      invokeAiRoute(counselingWrite, "/api/ai/college-counseling/write/item", "POST", {
        body: args,
        params: { op: "item" },
      }),
  );

  tool(
    server,
    "patchCollegeCounseling",
    "Merge counseling document fields",
    "Use for overview, counselor_todo, narratives, and financial_aid text. Merges onto the current document and does not delete cards.",
    z.object({
      data: z.record(z.string(), z.unknown()),
    }),
    false,
    (args) =>
      invokeAiRoute(
        counselingWrite,
        "/api/ai/college-counseling/write/document",
        "POST",
        { body: args, params: { op: "document" } },
      ),
  );

  tool(
    server,
    "getCollegeCounselingContextPack",
    "College counseling context pack",
    "Use when a markdown briefing of the counseling document is needed. Read-only. Does not call another model.",
    none,
    true,
    () =>
      invokeAiRoute(
        counselingPackGet,
        "/api/ai/college-counseling/context-pack",
        "GET",
      ),
  );

  tool(
    server,
    "getStudySessions",
    "List study sessions",
    "Use to list study-timer blocks. Filter with from, to, subject, and limit.",
    z.object({
      from: isoDate.optional(),
      to: isoDate.optional(),
      subject: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    true,
    (args) =>
      invokeAiRoute(studySessionsGet, "/api/ai/study/sessions", "GET", {
        query: args,
      }),
  );

  tool(
    server,
    "saveStudySession",
    "Log or edit a study session",
    "Use to log study minutes. Include id to edit. Prefer subject names from the Study page. Confirm unless Emre asked to save.",
    z.object({
      id: z.string().optional(),
      subject: z.string().optional(),
      duration_minutes: z.number().int().min(1).optional(),
      session_date: isoDate.optional(),
      notes: z.string().nullable().optional(),
    }),
    false,
    (args) =>
      invokeAiRoute(studySessionsPost, "/api/ai/study/sessions", "POST", {
        body: args,
      }),
  );

  tool(
    server,
    "getStudyStats",
    "Study time totals",
    "Use for today, week, and month study minutes.",
    none,
    true,
    () => invokeAiRoute(studyStatsGet, "/api/ai/study/stats", "GET"),
  );

  tool(
    server,
    "getSatPracticeSummary",
    "SAT practice overview",
    "Use for QBank R&W and Math trends, weak skills, focus_next, and the latest official Bluebook score. Do not invent scores.",
    none,
    true,
    () =>
      invokeAiRoute(practiceSummaryGet, "/api/ai/sat-practice/summary", "GET"),
  );

  tool(
    server,
    "getSatPracticeAttempts",
    "List SAT practice mocks",
    "Use to list completed mocks. section is rw, math, or full (Bluebook).",
    z.object({
      section: z.enum(["rw", "math", "full"]).optional(),
    }),
    true,
    (args) =>
      invokeAiRoute(practiceAttemptsGet, "/api/ai/sat-practice/attempts", "GET", {
        query: args,
      }),
  );

  tool(
    server,
    "getSatPracticeReport",
    "SAT practice results report",
    "Use for the long results text, rationales, and misses. Omit id for the latest completed mock. misses_only skips the long string. If include_timing_in_report is false, ignore pacing.",
    z.object({
      id: z.string().optional(),
      misses_only: z.boolean().optional(),
    }),
    true,
    (args) =>
      invokeAiRoute(practiceReportGet, "/api/ai/sat-practice/report", "GET", {
        query: args,
      }),
  );
}
