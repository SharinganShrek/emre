import { buildSeedData } from "./seed";
import type { HubData } from "./types";
import type { SyncedHubPayload } from "./supabase/hub-repository";

/** Collections that remain in localStorage when Supabase is enabled. */
export type LocalOnlyData = Pick<HubData, "gymSessions" | "gymExercises">;

export const LOCAL_ONLY_STORAGE_KEY = "emre-hub:local:v1";
export const LEGACY_STORAGE_KEY = "emre-hub:data:v2";

export function extractLocalOnly(data: HubData): LocalOnlyData {
  return {
    gymSessions: data.gymSessions,
    gymExercises: data.gymExercises,
  };
}

function arr<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? value : fallback;
}

/** Load non-synced collections from localStorage (Supabase mode). */
export function loadLocalOnlyData(userId: string): LocalOnlyData {
  const seed = buildSeedData();
  const withUser = <T extends { user_id: string }>(rows: T[]): T[] =>
    rows.map((r) => ({ ...r, user_id: userId }));

  try {
    const raw = localStorage.getItem(LOCAL_ONLY_STORAGE_KEY);
    if (!raw) {
      return {
        gymSessions: withUser(seed.gymSessions),
        gymExercises: withUser(seed.gymExercises),
      };
    }
    const parsed = JSON.parse(raw) as Partial<LocalOnlyData>;
    return {
      gymSessions: arr(parsed.gymSessions, withUser(seed.gymSessions)),
      gymExercises: arr(parsed.gymExercises, withUser(seed.gymExercises)),
    };
  } catch {
    return extractLocalOnly(buildSeedData());
  }
}

export function saveLocalOnlyData(data: HubData): void {
  try {
    localStorage.setItem(
      LOCAL_ONLY_STORAGE_KEY,
      JSON.stringify(extractLocalOnly(data)),
    );
  } catch {
    /* ignore */
  }
}

/** Safely parse legacy full localStorage payload (local mock mode). */
export function parseStoredHubData(raw: string): HubData {
  const seed = buildSeedData();
  try {
    const parsed = JSON.parse(raw) as Partial<HubData>;
    if (!parsed || typeof parsed !== "object") return seed;
    const mergeArr = <T,>(value: unknown, fallback: T[]) =>
      Array.isArray(value) ? value : fallback;
    return {
      profile: { ...seed.profile, ...(parsed.profile ?? {}) },
      habits: mergeArr(parsed.habits, seed.habits),
      habitLogs: mergeArr(parsed.habitLogs, seed.habitLogs),
      tasks: mergeArr(parsed.tasks, seed.tasks),
      goals: mergeArr(parsed.goals, seed.goals),
      milestones: mergeArr(parsed.milestones, seed.milestones),
      studySessions: mergeArr(parsed.studySessions, seed.studySessions),
      practiceTests: mergeArr(parsed.practiceTests, seed.practiceTests),
      researchProjects: mergeArr(parsed.researchProjects, seed.researchProjects),
      researchPapers: mergeArr(parsed.researchPapers, seed.researchPapers),
      researchExperiments: mergeArr(
        parsed.researchExperiments,
        seed.researchExperiments,
      ),
      gymSessions: mergeArr(parsed.gymSessions, seed.gymSessions),
      gymExercises: mergeArr(parsed.gymExercises, seed.gymExercises),
      movies: mergeArr(parsed.movies, seed.movies),
      books: mergeArr(parsed.books, seed.books),
      journal: mergeArr(parsed.journal, seed.journal),
      notes: mergeArr(parsed.notes, seed.notes),
    };
  } catch {
    return seed;
  }
}

/** Merge Supabase synced payload with local-only collections. */
export function mergeHubData(
  userId: string,
  synced: SyncedHubPayload,
  localOnly: LocalOnlyData,
): HubData {
  const seed = buildSeedData();
  return {
    profile: synced.profile ?? {
      ...seed.profile,
      user_id: userId,
    },
    habits: synced.habits,
    habitLogs: synced.habitLogs,
    tasks: synced.tasks,
    journal: synced.journal,
    movies: synced.movies,
    goals: synced.goals,
    milestones: synced.milestones,
    studySessions: synced.studySessions,
    practiceTests: synced.practiceTests,
    researchProjects: synced.researchProjects,
    researchPapers: synced.researchPapers,
    researchExperiments: synced.researchExperiments,
    books: synced.books,
    notes: synced.notes,
    gymSessions: localOnly.gymSessions,
    gymExercises: localOnly.gymExercises,
  };
}

/** Empty synced collections when hub sync is unavailable. */
export function buildGuestSupabaseHub(localOnly?: LocalOnlyData): HubData {
  const seed = buildSeedData();
  const local = localOnly ?? extractLocalOnly(seed);
  return {
    profile: seed.profile,
    habits: [],
    habitLogs: [],
    tasks: [],
    journal: [],
    movies: [],
    goals: [],
    milestones: [],
    studySessions: [],
    practiceTests: [],
    researchProjects: [],
    researchPapers: [],
    researchExperiments: [],
    books: [],
    notes: [],
    ...local,
  };
}
