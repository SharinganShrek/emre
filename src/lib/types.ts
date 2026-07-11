/**
 * Domain types for Emre.
 * These mirror the Supabase/Postgres schema in `supabase/schema.sql`
 * so the local store can be swapped for a Supabase-backed store later.
 */

export interface BaseRow {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Profile extends BaseRow {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  timezone: string;
  bio?: string | null;
}

export type HabitFrequency = "daily" | "weekly";
export type HabitStatus = "active" | "archived";

export interface Habit extends BaseRow {
  user_id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color: string;
  frequency: HabitFrequency;
  target_per_day: number;
  status: HabitStatus;
  sort_order: number;
}

export interface HabitLog extends BaseRow {
  user_id: string;
  habit_id: string;
  /** ISO date (YYYY-MM-DD) the log applies to. */
  log_date: string;
  completed: boolean;
  count: number;
  note?: string | null;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task extends BaseRow {
  user_id: string;
  title: string;
  notes?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  project?: string | null;
}

export type GoalStatus = "active" | "completed" | "paused";

export interface Goal extends BaseRow {
  user_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  status: GoalStatus;
  progress: number; // 0-100
  target_date?: string | null;
}

export interface GoalMilestone extends BaseRow {
  user_id: string;
  goal_id: string;
  title: string;
  done: boolean;
  due_date?: string | null;
  sort_order: number;
}

export interface StudySession extends BaseRow {
  user_id: string;
  subject: string;
  duration_minutes: number;
  session_date: string;
  notes?: string | null;
}

export interface PracticeTest extends BaseRow {
  user_id: string;
  test_name: string;
  test_date: string;
  math_score?: number | null;
  reading_writing_score?: number | null;
  total_score?: number | null;
  notes?: string | null;
}

export type ResearchProjectStatus = "planning" | "active" | "on_hold" | "done";

export interface ResearchProject extends BaseRow {
  user_id: string;
  title: string;
  description?: string | null;
  status: ResearchProjectStatus;
}

export type PaperStatus = "to_read" | "reading" | "read";

export interface ResearchPaper extends BaseRow {
  user_id: string;
  project_id?: string | null;
  title: string;
  authors?: string | null;
  url?: string | null;
  status: PaperStatus;
  notes?: string | null;
}

export type ExperimentStatus = "planned" | "running" | "done" | "failed";

export interface ResearchExperiment extends BaseRow {
  user_id: string;
  project_id: string;
  name: string;
  hypothesis?: string | null;
  result?: string | null;
  status: ExperimentStatus;
  run_date?: string | null;
}

export interface GymSession extends BaseRow {
  user_id: string;
  session_date: string;
  duration_minutes: number;
  focus?: string | null;
  notes?: string | null;
}

export interface GymExercise extends BaseRow {
  user_id: string;
  session_id: string;
  name: string;
  sets: number;
  reps: number;
  weight_kg?: number | null;
}

export type WatchStatus = "planned" | "watching" | "watched";

/** Used for the "Anime / Movies" watched list. */
export interface Movie extends BaseRow {
  user_id: string;
  title: string;
  kind: "anime" | "movie" | "series";
  status: WatchStatus;
  rating?: number | null; // 0-10
  review?: string | null;
  watched_date?: string | null;
}

export type BookStatus = "to_read" | "reading" | "read";

export interface Book extends BaseRow {
  user_id: string;
  title: string;
  author?: string | null;
  status: BookStatus;
  rating?: number | null; // 0-10
  review?: string | null;
  finished_date?: string | null;
}

export interface JournalEntry extends BaseRow {
  user_id: string;
  entry_date: string;
  mood: number; // 1-5
  content: string;
}

export interface Note extends BaseRow {
  user_id: string;
  title: string;
  body: string;
  tags: string[];
  category: "idea" | "project" | "quote" | "note";
  pinned: boolean;
}

export type AiAction = "read" | "write";

export interface AiAuditLog extends BaseRow {
  user_id: string;
  route: string;
  action: AiAction;
  resource: string;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

/** Shape of the entire local dataset. */
export interface HubData {
  profile: Profile;
  habits: Habit[];
  habitLogs: HabitLog[];
  tasks: Task[];
  goals: Goal[];
  milestones: GoalMilestone[];
  studySessions: StudySession[];
  practiceTests: PracticeTest[];
  researchProjects: ResearchProject[];
  researchPapers: ResearchPaper[];
  researchExperiments: ResearchExperiment[];
  gymSessions: GymSession[];
  gymExercises: GymExercise[];
  movies: Movie[];
  books: Book[];
  journal: JournalEntry[];
  notes: Note[];
}
