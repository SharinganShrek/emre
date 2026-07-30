import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Book,
  Goal,
  GoalMilestone,
  Habit,
  HabitLog,
  HubData,
  JournalEntry,
  Movie,
  Note,
  PracticeTest,
  Profile,
  ResearchExperiment,
  ResearchPaper,
  ResearchProject,
  StudySession,
  Task,
} from "@/lib/types";

/** Hub collections synced to Supabase (Phase 1 + Phase 2). */
export const SYNCED_COLLECTIONS = [
  "habits",
  "habitLogs",
  "tasks",
  "journal",
  "movies",
  "goals",
  "milestones",
  "studySessions",
  "practiceTests",
  "researchProjects",
  "researchPapers",
  "researchExperiments",
  "books",
  "notes",
] as const;

export type SyncedCollection = (typeof SYNCED_COLLECTIONS)[number];

const TABLE_BY_COLLECTION: Record<SyncedCollection, string> = {
  habits: "habits",
  habitLogs: "habit_logs",
  tasks: "tasks",
  journal: "journal_entries",
  movies: "movies",
  goals: "goals",
  milestones: "goal_milestones",
  studySessions: "study_sessions",
  practiceTests: "practice_tests",
  researchProjects: "research_projects",
  researchPapers: "research_papers",
  researchExperiments: "research_experiments",
  books: "books",
  notes: "notes",
};

export interface SyncedHubPayload {
  profile: Profile | null;
  habits: Habit[];
  habitLogs: HabitLog[];
  tasks: Task[];
  journal: JournalEntry[];
  movies: Movie[];
  goals: Goal[];
  milestones: GoalMilestone[];
  studySessions: StudySession[];
  practiceTests: PracticeTest[];
  researchProjects: ResearchProject[];
  researchPapers: ResearchPaper[];
  researchExperiments: ResearchExperiment[];
  books: Book[];
  notes: Note[];
}

function asIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function mapProfile(row: Record<string, unknown>): Profile {
  return row as unknown as Profile;
}

function mapHabit(row: Record<string, unknown>): Habit {
  return row as unknown as Habit;
}

function mapHabitLog(row: Record<string, unknown>): HabitLog {
  return {
    ...(row as unknown as HabitLog),
    log_date: asIsoDate(String(row.log_date)) ?? String(row.log_date),
  };
}

function mapTask(row: Record<string, unknown>): Task {
  return {
    ...(row as unknown as Task),
    due_date: asIsoDate(row.due_date as string | null),
  };
}

function mapJournal(row: Record<string, unknown>): JournalEntry {
  return {
    ...(row as unknown as JournalEntry),
    entry_date: asIsoDate(String(row.entry_date)) ?? String(row.entry_date),
  };
}

function mapMovie(row: Record<string, unknown>): Movie {
  return {
    ...(row as unknown as Movie),
    watched_date: asIsoDate(row.watched_date as string | null),
  };
}

function mapGoal(row: Record<string, unknown>): Goal {
  return {
    ...(row as unknown as Goal),
    target_date: asIsoDate(row.target_date as string | null),
  };
}

function mapMilestone(row: Record<string, unknown>): GoalMilestone {
  return {
    ...(row as unknown as GoalMilestone),
    due_date: asIsoDate(row.due_date as string | null),
  };
}

function mapStudySession(row: Record<string, unknown>): StudySession {
  return {
    ...(row as unknown as StudySession),
    session_date:
      asIsoDate(String(row.session_date)) ?? String(row.session_date),
  };
}

function mapPracticeTest(row: Record<string, unknown>): PracticeTest {
  return {
    ...(row as unknown as PracticeTest),
    test_date: asIsoDate(String(row.test_date)) ?? String(row.test_date),
  };
}

function mapResearchProject(row: Record<string, unknown>): ResearchProject {
  return row as unknown as ResearchProject;
}

function mapResearchPaper(row: Record<string, unknown>): ResearchPaper {
  return row as unknown as ResearchPaper;
}

function mapResearchExperiment(
  row: Record<string, unknown>,
): ResearchExperiment {
  return {
    ...(row as unknown as ResearchExperiment),
    run_date: asIsoDate(row.run_date as string | null),
  };
}

function mapBook(row: Record<string, unknown>): Book {
  return {
    ...(row as unknown as Book),
    finished_date: asIsoDate(row.finished_date as string | null),
  };
}

function mapNote(row: Record<string, unknown>): Note {
  return row as unknown as Note;
}

/** Ensure a profile row exists for the fixed hub user (no Auth signup). */
export async function ensureProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile> {
  const existing = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return mapProfile(existing.data);

  const inserted = await supabase
    .from("profiles")
    .insert({
      user_id: userId,
      display_name: "Emre",
      timezone: "Europe/Istanbul",
    })
    .select("*")
    .single();
  if (inserted.error) throw inserted.error;
  return mapProfile(inserted.data);
}

/** Load synced tables + profile for the fixed hub user. */
export async function fetchSyncedHubData(
  supabase: SupabaseClient,
  userId: string,
): Promise<SyncedHubPayload> {
  const profile = await ensureProfile(supabase, userId);

  const [
    habitsRes,
    logsRes,
    tasksRes,
    journalRes,
    moviesRes,
    goalsRes,
    milestonesRes,
    studyRes,
    practiceRes,
    researchProjectsRes,
    researchPapersRes,
    researchExperimentsRes,
    booksRes,
    notesRes,
  ] = await Promise.all([
    supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", userId)
      .order("log_date", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false }),
    supabase
      .from("movies")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("goal_milestones")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("session_date", { ascending: false }),
    supabase
      .from("practice_tests")
      .select("*")
      .eq("user_id", userId)
      .order("test_date", { ascending: false }),
    supabase
      .from("research_projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("research_papers")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("research_experiments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);

  const errors = [
    habitsRes.error,
    logsRes.error,
    tasksRes.error,
    journalRes.error,
    moviesRes.error,
    goalsRes.error,
    milestonesRes.error,
    studyRes.error,
    practiceRes.error,
    researchProjectsRes.error,
    researchPapersRes.error,
    researchExperimentsRes.error,
    booksRes.error,
    notesRes.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors.map((e) => e!.message).join("; "));
  }

  return {
    profile,
    habits: (habitsRes.data ?? []).map(mapHabit),
    habitLogs: (logsRes.data ?? []).map(mapHabitLog),
    tasks: (tasksRes.data ?? []).map(mapTask),
    journal: (journalRes.data ?? []).map(mapJournal),
    movies: (moviesRes.data ?? []).map(mapMovie),
    goals: (goalsRes.data ?? []).map(mapGoal),
    milestones: (milestonesRes.data ?? []).map(mapMilestone),
    studySessions: (studyRes.data ?? []).map(mapStudySession),
    practiceTests: (practiceRes.data ?? []).map(mapPracticeTest),
    researchProjects: (researchProjectsRes.data ?? []).map(mapResearchProject),
    researchPapers: (researchPapersRes.data ?? []).map(mapResearchPaper),
    researchExperiments: (researchExperimentsRes.data ?? []).map(
      mapResearchExperiment,
    ),
    books: (booksRes.data ?? []).map(mapBook),
    notes: (notesRes.data ?? []).map(mapNote),
  };
}

function rowForInsert(
  collection: SyncedCollection,
  row: Record<string, unknown>,
  userId: string,
): Record<string, unknown> {
  const { id, created_at, updated_at, ...rest } = row;
  void created_at;
  void updated_at;
  void collection;
  return { id, ...rest, user_id: userId };
}

function rowForUpdate(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const { id, user_id, created_at, updated_at, ...rest } = patch;
  void id;
  void user_id;
  void created_at;
  void updated_at;
  return rest;
}

export async function insertSyncedRow(
  supabase: SupabaseClient,
  collection: SyncedCollection,
  row: Record<string, unknown>,
  userId: string,
): Promise<void> {
  const table = TABLE_BY_COLLECTION[collection];
  const { error } = await supabase
    .from(table)
    .insert(rowForInsert(collection, row, userId));
  if (error) throw error;
}

export async function updateSyncedRow(
  supabase: SupabaseClient,
  collection: SyncedCollection,
  id: string,
  patch: Record<string, unknown>,
  userId: string,
): Promise<void> {
  const table = TABLE_BY_COLLECTION[collection];
  const payload = rowForUpdate(patch);
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase
    .from(table)
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteSyncedRow(
  supabase: SupabaseClient,
  collection: SyncedCollection,
  id: string,
  userId: string,
): Promise<void> {
  const table = TABLE_BY_COLLECTION[collection];
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function upsertHabitLog(
  supabase: SupabaseClient,
  log: HabitLog,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("habit_logs").upsert(
    {
      id: log.id,
      user_id: userId,
      habit_id: log.habit_id,
      log_date: log.log_date,
      completed: log.completed,
      count: log.count,
      note: log.note,
    },
    { onConflict: "habit_id,log_date" },
  );
  if (error) throw error;
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<Profile>,
): Promise<void> {
  const { id, user_id, created_at, updated_at, ...rest } = patch;
  void id;
  void user_id;
  void created_at;
  void updated_at;
  if (Object.keys(rest).length === 0) return;
  const { error } = await supabase
    .from("profiles")
    .update(rest)
    .eq("user_id", userId);
  if (error) throw error;
}

export function isSyncedCollection(
  key: keyof HubData,
): key is SyncedCollection {
  return (SYNCED_COLLECTIONS as readonly string[]).includes(key);
}

export function getTableName(collection: SyncedCollection): string {
  return TABLE_BY_COLLECTION[collection];
}
