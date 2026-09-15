import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** Habit log update from the AI assistant. */
export const habitLogInput = z.object({
  habit_id: z.string().min(1),
  log_date: isoDate.optional(),
  completed: z.boolean(),
  note: z.string().max(500).optional(),
});
export type HabitLogInput = z.infer<typeof habitLogInput>;

export const taskInput = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  due_date: isoDate.optional(),
  project: z.string().max(100).optional(),
});
export type TaskInput = z.infer<typeof taskInput>;

export const movieInput = z.object({
  title: z.string().min(1).max(200),
  kind: z.enum(["anime", "movie", "series"]).default("anime"),
  status: z.enum(["planned", "watching", "watched"]).default("planned"),
  rating: z.number().min(0).max(10).optional(),
  review: z.string().max(2000).optional(),
  watched_date: isoDate.optional(),
});
export type MovieInput = z.infer<typeof movieInput>;

export const journalInput = z.object({
  entry_date: isoDate.optional(),
  mood: z.number().int().min(1).max(5),
  content: z.string().min(1).max(5000),
});
export type JournalInput = z.infer<typeof journalInput>;

export const noteInput = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(20000).default(""),
  tags: z.array(z.string().max(40)).default([]),
  category: z.enum(["idea", "project", "quote", "note"]).default("note"),
});
export type NoteInput = z.infer<typeof noteInput>;

/** GET /api/ai/tasks?status= */
export const taskListQuery = z.object({
  status: z.enum(["todo", "in_progress", "done"]).optional(),
});

/** GET /api/ai/journal/recent?limit= */
export const journalRecentQuery = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(7),
});

const satPlanId = z
  .string()
  .regex(/^plan-\d{3}$/, "Expected plan-001 … plan-070");

/** ChatGPT Actions often send empty strings for omitted optional query params. */
function emptyQueryValue(value: unknown): unknown {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

function queryBool(value: unknown, defaultValue = false): boolean {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  if (value === "" || value == null) return defaultValue;
  return defaultValue;
}

export const satVocabPlanQuery = z.object({
  week: z.preprocess(
    emptyQueryValue,
    z.coerce.number().int().min(1).max(10).optional(),
  ),
  include_words: z.preprocess(
    (value) => queryBool(value, false),
    z.boolean(),
  ),
});

export const satVocabSessionQuery = z.object({
  plan_id: z.preprocess(emptyQueryValue, satPlanId.optional()),
  date: z.preprocess(emptyQueryValue, isoDate.optional()),
  session_num: z.preprocess(
    emptyQueryValue,
    z.coerce.number().int().min(1).max(50).optional(),
  ),
  detail: z.preprocess(
    emptyQueryValue,
    z.enum(["compact", "full"]).default("compact"),
  ),
});

export const satVocabWordsQuery = z.object({
  word: z.preprocess(emptyQueryValue, z.string().min(1).max(80).optional()),
  q: z.preprocess(emptyQueryValue, z.string().min(1).max(80).optional()),
  theme: z.preprocess(emptyQueryValue, z.string().min(1).max(80).optional()),
  offset: z.preprocess(emptyQueryValue, z.coerce.number().int().min(0).default(0)),
  limit: z.preprocess(emptyQueryValue, z.coerce.number().int().min(1).max(40).default(20)),
  detail: z.preprocess(
    emptyQueryValue,
    z.enum(["compact", "full"]).default("compact"),
  ),
});

export const satVocabWeakQuery = z.object({
  limit: z.preprocess(emptyQueryValue, z.coerce.number().int().min(1).max(40).default(20)),
});

const satWordResult = z.object({
  word: z.string().min(1).max(80),
  correct: z.boolean(),
  chosen: z.string().max(400).nullable().optional(),
  expected: z.string().max(400).nullable().optional(),
});

const satMcItem = z.object({
  word: z.string().min(1).max(80),
  prompt: z.string().min(1).max(800),
  choices: z.array(z.string().min(1).max(300)).min(2).max(6),
  answer: z.union([z.string().min(1).max(300), z.number().int().min(0).max(5)]),
});

const satTypeItem = z.object({
  word: z.string().min(1).max(80),
  prompt: z.string().min(1).max(800),
  accepted: z.array(z.string().min(1).max(120)).min(1).max(12),
});

const satMixedItem = z.discriminatedUnion("kind", [
  satMcItem.extend({ kind: z.literal("multiple_choice") }),
  satTypeItem.extend({ kind: z.literal("type_word") }),
  satTypeItem.extend({ kind: z.literal("type_definition") }),
]);

export const satVocabProgressWrite = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("learn"),
    plan_id: satPlanId,
    known_words: z.array(z.string().min(1).max(80)).max(40).optional(),
  }),
  z.object({
    action: z.literal("test"),
    plan_id: satPlanId,
    drill: z.enum([
      "matching",
      "type_word",
      "type_definition",
      "multiple_choice",
      "mixed",
    ]),
    score: z.number().int().min(0).max(100),
    results: z.array(satWordResult).max(40).optional(),
  }),
  z.object({
    action: z.literal("rest"),
    plan_id: satPlanId,
  }),
  z.object({
    action: z.literal("word_results"),
    results: z.array(satWordResult).min(1).max(40),
  }),
  z.object({
    action: z.literal("send_test"),
    plan_id: satPlanId,
    title: z.string().max(120).optional(),
    test: z.discriminatedUnion("format", [
      z.object({
        format: z.literal("multiple_choice"),
        items: z.array(satMcItem).min(1).max(200),
      }),
      z.object({
        format: z.literal("type_word"),
        items: z.array(satTypeItem).min(1).max(200),
      }),
      z.object({
        format: z.literal("type_definition"),
        items: z.array(satTypeItem).min(1).max(200),
      }),
      z.object({
        format: z.literal("matching"),
        items: z
          .array(
            z.object({
              word: z.string().min(1).max(80),
              definition: z.string().min(1).max(400),
            }),
          )
          .min(2)
          .max(200),
      }),
      z.object({
        format: z.literal("mixed"),
        items: z
          .array(satMixedItem)
          .min(1)
          .max(200)
          .refine(
            (items) => new Set(items.map((item) => item.kind)).size >= 2,
            {
              message:
                "mixed tests need at least two kinds (multiple_choice, type_word, type_definition)",
            },
          ),
      }),
    ]),
  }),
]);
export type SatVocabProgressWrite = z.infer<typeof satVocabProgressWrite>;

const activityPriority = z.enum(["high", "medium", "low"]);
const activityStatus = z.enum(["draft", "needs_revision", "ready"]);

export const activityItemInput = z.object({
  id: z.string().min(1).max(80).optional(),
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(80).default("Other"),
  role: z.string().max(200).default(""),
  organization: z.string().max(200).default(""),
  grade_levels: z.string().max(80).default(""),
  hours_per_week: z.coerce.number().min(0).max(168).default(0),
  weeks_per_year: z.coerce.number().min(0).max(52).default(0),
  common_app_description: z.string().max(4000).default(""),
  expanded_description: z.string().max(20000).default(""),
  impact_metrics: z.string().max(4000).default(""),
  evidence_link: z.string().max(500).nullable().optional(),
  priority: activityPriority.default("medium"),
  framing_notes: z.string().max(2000).default(""),
  risk_notes: z.string().max(2000).default(""),
  status: activityStatus.default("draft"),
});

export const collegeTestItem = z.object({
  name: z.string().min(1).max(120),
  status: z.string().max(80).optional(),
  score: z.union([z.string().max(40), z.number(), z.null()]).optional(),
  target: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export const collegeProfilePatch = z
  .object({
    full_name: z.string().max(200).optional(),
    school: z.string().max(200).optional(),
    country: z.string().max(80).optional(),
    current_grade: z.string().max(80).optional(),
    graduation_year: z.coerce.number().int().min(2020).max(2040).optional(),
    citizenship: z.array(z.string().max(80)).optional(),
    intended_fields: z.array(z.string().max(120)).optional(),
    positioning_idea: z.string().max(4000).optional(),
    us_strategy: z.string().max(4000).optional(),
    europe_strategy: z.string().max(4000).optional(),
    academic_records: z.array(z.record(z.string(), z.unknown())).optional(),
    testing: z.array(collegeTestItem).optional(),
    constraints: z.array(z.string().max(400)).optional(),
    preferences: z.array(z.string().max(400)).optional(),
    positioning: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const counselingItemSection = z.enum([
  "activities",
  "research",
  "schools",
  "timeline",
  "essays",
  "recommendations",
  "weekly_checkins",
  "testing",
  "academic_records",
]);

const counselingSection = z.enum([
  "profile",
  "overview",
  "activities",
  "research",
  "schools",
  "timeline",
  "essays",
  "financial_aid",
  "recommendations",
  "weekly_checkins",
  "research_narrative",
  "brag_sheet_notes",
  "counselor_todo",
]);

export const collegeCounselingWrite = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("replace"),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("patch"),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("update_profile"),
    patch: collegeProfilePatch,
  }),
  z.object({
    action: z.literal("update_testing"),
    testing: z.array(collegeTestItem).min(1).max(40),
  }),
  z.object({
    action: z.literal("update_section"),
    section: counselingSection,
    data: z.unknown(),
  }),
  z.object({
    action: z.literal("add_activity"),
    activity: activityItemInput,
  }),
  z.object({
    action: z.literal("update_activity"),
    id: z.string().min(1).max(80),
    patch: activityItemInput.partial(),
  }),
  z.object({
    action: z.literal("add_item"),
    section: counselingItemSection,
    item: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("update_item"),
    section: counselingItemSection,
    id: z.string().min(1).max(80),
    patch: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("delete_item"),
    section: counselingItemSection,
    id: z.string().min(1).max(80),
  }),
]);
export type CollegeCounselingWrite = z.infer<typeof collegeCounselingWrite>;

export const studySessionQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  subject: z.string().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

export const studySessionInput = z.object({
  subject: z.string().min(1).max(80),
  duration_minutes: z.number().int().min(1).max(24 * 60),
  session_date: isoDate.optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const studySessionPatch = z.object({
  id: z.string().min(1),
  subject: z.string().min(1).max(80).optional(),
  duration_minutes: z.number().int().min(1).max(24 * 60).optional(),
  session_date: isoDate.optional(),
  notes: z.string().max(4000).nullable().optional(),
});
export type StudySessionInput = z.infer<typeof studySessionInput>;
