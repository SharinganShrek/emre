import type { HubData } from "./types";
import { toISODate } from "./utils";

const USER = "local-user";

function ts(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function dateOnly(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toISODate(d);
}

const now = ts(0);

const HABIT_DEFS = [
  { name: "SAT Vocabulary", color: "#7c9cff", icon: "BookA" },
  { name: "SAT Reading", color: "#8b5cf6", icon: "BookOpen" },
  { name: "SAT Math", color: "#34d399", icon: "Sigma" },
  { name: "Skincare", color: "#fbbf24", icon: "Sparkles" },
  { name: "Gym", color: "#f87171", icon: "Dumbbell" },
  { name: "Sleep goal", color: "#38bdf8", icon: "Moon" },
];

/** Build a fresh copy of the seed dataset. */
export function buildSeedData(): HubData {
  const habits = HABIT_DEFS.map((h, i) => ({
    id: `habit_${i + 1}`,
    user_id: USER,
    name: h.name,
    description: null,
    icon: h.icon,
    color: h.color,
    frequency: "daily" as const,
    target_per_day: 1,
    status: "active" as const,
    sort_order: i,
    created_at: ts(-30),
    updated_at: now,
  }));

  // Generate ~21 days of habit logs with a believable completion pattern.
  const habitLogs = [];
  for (let d = 20; d >= 0; d--) {
    const logDate = dateOnly(-d);
    for (const habit of habits) {
      // deterministic-ish pattern so streaks look real
      const seed = (parseInt(habit.id.split("_")[1], 10) * 7 + d * 3) % 10;
      const completed = seed > 2;
      habitLogs.push({
        id: `hl_${habit.id}_${d}`,
        user_id: USER,
        habit_id: habit.id,
        log_date: logDate,
        completed,
        count: completed ? 1 : 0,
        note: null,
        created_at: ts(-d),
        updated_at: ts(-d),
      });
    }
  }

  return {
    profile: {
      id: "profile_1",
      user_id: USER,
      display_name: "Emre",
      avatar_url: null,
      timezone: "Europe/Istanbul",
      bio: "Building Emre — my personal operating system.",
      created_at: ts(-60),
      updated_at: now,
    },
    habits,
    habitLogs,
    tasks: [
      { id: "task_1", user_id: USER, title: "Finish SAT reading practice set 4", notes: null, status: "todo", priority: "high", due_date: dateOnly(1), project: "SAT", created_at: ts(-2), updated_at: now },
      { id: "task_2", user_id: USER, title: "Draft intro for lung CT paper", notes: "Focus on motivation + related work", status: "in_progress", priority: "high", due_date: dateOnly(3), project: "Research", created_at: ts(-4), updated_at: now },
      { id: "task_3", user_id: USER, title: "Build Analytics page for Emre", notes: null, status: "in_progress", priority: "medium", due_date: dateOnly(0), project: "Emre", created_at: ts(-1), updated_at: now },
      { id: "task_4", user_id: USER, title: "Book gym induction", notes: null, status: "todo", priority: "low", due_date: dateOnly(5), project: "Fitness", created_at: ts(-1), updated_at: now },
      { id: "task_5", user_id: USER, title: "Review 30 new vocab words", notes: null, status: "done", priority: "medium", due_date: dateOnly(-1), project: "SAT", created_at: ts(-3), updated_at: now },
    ],
    goals: [
      { id: "goal_1", user_id: USER, title: "SAT 1550+", description: "Score 1550 or higher on the SAT.", category: "Academics", status: "active", progress: 62, target_date: dateOnly(120), created_at: ts(-40), updated_at: now },
      { id: "goal_2", user_id: USER, title: "Publish AI research paper", description: "Submit lung CT segmentation paper to a workshop.", category: "Research", status: "active", progress: 35, target_date: dateOnly(180), created_at: ts(-50), updated_at: now },
      { id: "goal_3", user_id: USER, title: "Build Emre", description: "Ship a personal life OS.", category: "Projects", status: "active", progress: 55, target_date: dateOnly(30), created_at: ts(-20), updated_at: now },
      { id: "goal_4", user_id: USER, title: "Gym consistency", description: "Train at least 3x per week for a full term.", category: "Health", status: "active", progress: 48, target_date: dateOnly(90), created_at: ts(-25), updated_at: now },
      { id: "goal_5", user_id: USER, title: "Improve sleep", description: "Average 7.5h of sleep per night.", category: "Health", status: "active", progress: 40, target_date: dateOnly(60), created_at: ts(-15), updated_at: now },
    ],
    milestones: [
      { id: "ms_1", user_id: USER, goal_id: "goal_1", title: "Full-length test above 1450", done: true, due_date: dateOnly(-10), sort_order: 0, created_at: ts(-40), updated_at: now },
      { id: "ms_2", user_id: USER, goal_id: "goal_1", title: "Math consistently above 750", done: false, due_date: dateOnly(40), sort_order: 1, created_at: ts(-40), updated_at: now },
      { id: "ms_3", user_id: USER, goal_id: "goal_1", title: "Reading above 730", done: false, due_date: dateOnly(70), sort_order: 2, created_at: ts(-40), updated_at: now },
      { id: "ms_4", user_id: USER, goal_id: "goal_2", title: "Finish dataset preprocessing", done: true, due_date: dateOnly(-5), sort_order: 0, created_at: ts(-50), updated_at: now },
      { id: "ms_5", user_id: USER, goal_id: "goal_2", title: "Baseline U-Net results", done: false, due_date: dateOnly(30), sort_order: 1, created_at: ts(-50), updated_at: now },
      { id: "ms_6", user_id: USER, goal_id: "goal_3", title: "Dashboard + Habits pages", done: true, due_date: dateOnly(-2), sort_order: 0, created_at: ts(-20), updated_at: now },
      { id: "ms_7", user_id: USER, goal_id: "goal_3", title: "AI-ready API routes", done: false, due_date: dateOnly(10), sort_order: 1, created_at: ts(-20), updated_at: now },
    ],
    studySessions: [
      { id: "ss_1", user_id: USER, subject: "SAT Math", duration_minutes: 60, session_date: dateOnly(-1), notes: "Algebra + heart of algebra drills", created_at: ts(-1), updated_at: now },
      { id: "ss_2", user_id: USER, subject: "SAT Reading", duration_minutes: 45, session_date: dateOnly(-2), notes: "2 passages, timed", created_at: ts(-2), updated_at: now },
      { id: "ss_3", user_id: USER, subject: "SAT Vocabulary", duration_minutes: 30, session_date: dateOnly(-3), notes: "Anki review", created_at: ts(-3), updated_at: now },
      { id: "ss_4", user_id: USER, subject: "SAT Math", duration_minutes: 75, session_date: dateOnly(-5), notes: "Problem set 3", created_at: ts(-5), updated_at: now },
      { id: "ss_5", user_id: USER, subject: "SAT Reading", duration_minutes: 50, session_date: dateOnly(-8), notes: null, created_at: ts(-8), updated_at: now },
      { id: "ss_6", user_id: USER, subject: "SAT Math", duration_minutes: 40, session_date: dateOnly(-9), notes: null, created_at: ts(-9), updated_at: now },
    ],
    practiceTests: [
      { id: "pt_1", user_id: USER, test_name: "College Board Practice 1", test_date: dateOnly(-21), math_score: 690, reading_writing_score: 660, total_score: 1350, notes: "Baseline", created_at: ts(-21), updated_at: now },
      { id: "pt_2", user_id: USER, test_name: "College Board Practice 2", test_date: dateOnly(-10), math_score: 720, reading_writing_score: 690, total_score: 1410, notes: "Improved timing", created_at: ts(-10), updated_at: now },
      { id: "pt_3", user_id: USER, test_name: "College Board Practice 3", test_date: dateOnly(-3), math_score: 740, reading_writing_score: 710, total_score: 1450, notes: "Careless math errors", created_at: ts(-3), updated_at: now },
    ],
    researchProjects: [
      { id: "rp_1", user_id: USER, title: "Lung CT Segmentation Research", description: "Segment lung nodules from CT scans using a U-Net variant; target a workshop submission.", status: "active", created_at: ts(-50), updated_at: now },
    ],
    researchPapers: [
      { id: "paper_1", user_id: USER, project_id: "rp_1", title: "U-Net: Convolutional Networks for Biomedical Image Segmentation", authors: "Ronneberger et al.", url: "https://arxiv.org/abs/1505.04597", status: "read", notes: "Core architecture reference.", created_at: ts(-40), updated_at: now },
      { id: "paper_2", user_id: USER, project_id: "rp_1", title: "nnU-Net: a self-configuring method for deep learning-based biomedical image segmentation", authors: "Isensee et al.", url: "https://arxiv.org/abs/1809.10486", status: "reading", notes: "Consider as strong baseline.", created_at: ts(-20), updated_at: now },
    ],
    researchExperiments: [
      { id: "exp_1", user_id: USER, project_id: "rp_1", name: "Baseline U-Net (256x256)", hypothesis: "Vanilla U-Net reaches >0.80 Dice.", result: "Dice 0.78 after 40 epochs.", status: "done", run_date: dateOnly(-12), created_at: ts(-12), updated_at: now },
      { id: "exp_2", user_id: USER, project_id: "rp_1", name: "U-Net + data augmentation", hypothesis: "Augmentation improves generalization.", result: null, status: "running", run_date: dateOnly(-1), created_at: ts(-1), updated_at: now },
    ],
    gymSessions: [
      { id: "gs_1", user_id: USER, session_date: dateOnly(-1), duration_minutes: 55, focus: "Push", notes: "Chest + triceps", created_at: ts(-1), updated_at: now },
      { id: "gs_2", user_id: USER, session_date: dateOnly(-3), duration_minutes: 60, focus: "Pull", notes: "Back + biceps", created_at: ts(-3), updated_at: now },
      { id: "gs_3", user_id: USER, session_date: dateOnly(-5), duration_minutes: 50, focus: "Legs", notes: null, created_at: ts(-5), updated_at: now },
      { id: "gs_4", user_id: USER, session_date: dateOnly(-8), duration_minutes: 45, focus: "Push", notes: null, created_at: ts(-8), updated_at: now },
    ],
    gymExercises: [
      { id: "ge_1", user_id: USER, session_id: "gs_1", name: "Bench Press", sets: 4, reps: 8, weight_kg: 60, created_at: ts(-1), updated_at: now },
      { id: "ge_2", user_id: USER, session_id: "gs_1", name: "Incline Dumbbell Press", sets: 3, reps: 10, weight_kg: 22, created_at: ts(-1), updated_at: now },
      { id: "ge_3", user_id: USER, session_id: "gs_2", name: "Deadlift", sets: 3, reps: 5, weight_kg: 100, created_at: ts(-3), updated_at: now },
    ],
    movies: [
      { id: "mv_1", user_id: USER, title: "Frieren: Beyond Journey's End", kind: "anime", status: "watched", rating: 10, review: "Quiet, gorgeous, and emotionally precise.", watched_date: dateOnly(-6), created_at: ts(-6), updated_at: now },
      { id: "mv_2", user_id: USER, title: "Vinland Saga", kind: "anime", status: "watching", rating: 9, review: "Thorfinn's arc is incredible.", watched_date: null, created_at: ts(-3), updated_at: now },
      { id: "mv_3", user_id: USER, title: "Steins;Gate", kind: "anime", status: "planned", rating: null, review: null, watched_date: null, created_at: ts(-1), updated_at: now },
      { id: "mv_4", user_id: USER, title: "Oppenheimer", kind: "movie", status: "watched", rating: 9, review: "Tense and beautifully shot.", watched_date: dateOnly(-15), created_at: ts(-15), updated_at: now },
    ],
    books: [
      { id: "bk_1", user_id: USER, title: "Deep Learning", author: "Goodfellow, Bengio, Courville", status: "reading", rating: null, review: null, finished_date: null, created_at: ts(-10), updated_at: now },
      { id: "bk_2", user_id: USER, title: "Atomic Habits", author: "James Clear", status: "read", rating: 8, review: "Great framework for habit stacking.", finished_date: dateOnly(-30), created_at: ts(-30), updated_at: now },
      { id: "bk_3", user_id: USER, title: "The Pragmatic Programmer", author: "Hunt & Thomas", status: "to_read", rating: null, review: null, finished_date: null, created_at: ts(-2), updated_at: now },
    ],
    journal: [
      { id: "j_1", user_id: USER, entry_date: dateOnly(0), mood: 4, content: "Productive day. Shipped the dashboard skeleton and did an hour of SAT math.", created_at: ts(0), updated_at: now },
      { id: "j_2", user_id: USER, entry_date: dateOnly(-1), mood: 3, content: "Tired but consistent. Gym + reading practice.", created_at: ts(-1), updated_at: now },
      { id: "j_3", user_id: USER, entry_date: dateOnly(-2), mood: 5, content: "Great session on the research paper. Momentum is building.", created_at: ts(-2), updated_at: now },
      { id: "j_4", user_id: USER, entry_date: dateOnly(-4), mood: 3, content: "Slept badly, still hit vocab review.", created_at: ts(-4), updated_at: now },
    ],
    notes: [
      { id: "n_1", user_id: USER, title: "Emre roadmap", body: "MVP: dashboard, habits, goals, study.\nNext: AI assistant reads habits + tasks.\nLater: mobile PWA.", tags: ["emre", "roadmap"], category: "project", pinned: true, created_at: ts(-5), updated_at: now },
      { id: "n_2", user_id: USER, title: "Idea: SAT vocab spaced-repetition bot", body: "Telegram bot that quizzes 5 words a day and logs to Emre via the AI API.", tags: ["idea", "sat", "ai"], category: "idea", pinned: false, created_at: ts(-3), updated_at: now },
      { id: "n_3", user_id: USER, title: "Quote", body: "\"Discipline is choosing between what you want now and what you want most.\"", tags: ["motivation"], category: "quote", pinned: false, created_at: ts(-1), updated_at: now },
    ],
  };
}
