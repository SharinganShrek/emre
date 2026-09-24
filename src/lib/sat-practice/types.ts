export type SatSection = "rw" | "math" | "full";
export type SatAttemptSource = "qbank" | "bluebook";
export type SatPart = "rw" | "math";

export type SatAttemptStatus = "ready" | "module1_done" | "completed";

export type SatDifficulty = "Easy" | "Medium" | "Hard" | string;

export interface SatAnswerOption {
  letter: string;
  content: string;
}

export interface SatQuestion {
  externalId?: string;
  domainCode?: string;
  domain: string;
  skillCode?: string;
  skill: string;
  difficultyCode?: string;
  difficulty: SatDifficulty;
  stimulus: string;
  prompt: string;
  answerOptions: SatAnswerOption[];
  correctAnswers: string[];
  rationale: string;
  /** Manual credit (e.g. rendering bug on an old mock). */
  creditGiven?: boolean;
}

export interface SatSectionModules {
  m1: SatQuestion[];
  m2: SatQuestion[];
}

export interface SatModules extends SatSectionModules {
  rw?: SatSectionModules;
  math?: SatSectionModules;
}

export type SatAnswerMap = Record<string, string>;
export type SatFlagMap = Record<string, boolean>;
export type SatTimingMap = Record<string, number | null>;

export interface SatDomainStat {
  domain: string;
  domainCode?: string;
  correct: number;
  total: number;
  easyCorrect: number;
  easyTotal: number;
  mediumCorrect: number;
  mediumTotal: number;
  hardCorrect: number;
  hardTotal: number;
  bars: number;
}

export interface SatPracticeAttempt {
  id: string;
  user_id: string;
  section: SatSection;
  source: SatAttemptSource;
  roster_id?: string | null;
  title: string;
  status: SatAttemptStatus;
  include_timing_in_report: boolean;
  source_html?: string | null;
  modules: SatModules;
  answers: SatAnswerMap;
  flagged: SatFlagMap;
  seconds_spent: SatTimingMap;
  module1_seconds_left?: number | null;
  module2_seconds_left?: number | null;
  raw_correct?: number | null;
  raw_total?: number | null;
  scaled_estimated?: number | null;
  official_total?: number | null;
  official_rw?: number | null;
  official_math?: number | null;
  domain_stats?: SatDomainStat[] | null;
  started_at: string;
  module1_completed_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type SatPracticeAttemptSummary = Omit<
  SatPracticeAttempt,
  "source_html" | "modules" | "answers" | "flagged" | "seconds_spent"
> & {
  has_html: boolean;
  question_count: number;
};

export interface SatPracticeSettings {
  has_ingest_token: boolean;
  used_external_id_count: number;
  used_content_hash_count: number;
}

export interface SatQuestionRow {
  key: string;
  module: 1 | 2;
  index: number;
  number: number;
  sectionKey: SatPart;
  sectionLabel: string;
  question: SatQuestion;
  chosen: string;
  correct: string;
  isCorrect: boolean;
  flagged: boolean;
  secondsSpent: number | null;
}

export const RW_DOMAIN_ORDER = [
  "Craft and Structure",
  "Information and Ideas",
  "Standard English Conventions",
  "Expression of Ideas",
] as const;

export const MATH_DOMAIN_ORDER = [
  "Algebra",
  "Advanced Math",
  "Problem-Solving and Data Analysis",
  "Geometry and Trigonometry",
] as const;

export const SECTION_META: Record<
  SatSection,
  {
    label: string;
    short: string;
    questionsPerModule: number;
    secondsPerModule: number;
    scaleMin: number;
    scaleMax: number;
    khanUrl: string;
  }
> = {
  rw: {
    label: "Reading and Writing",
    short: "R&W",
    questionsPerModule: 27,
    secondsPerModule: 32 * 60,
    scaleMin: 200,
    scaleMax: 800,
    khanUrl: "https://www.khanacademy.org/test-prep/sat-reading-and-writing",
  },
  math: {
    label: "Math",
    short: "Math",
    questionsPerModule: 22,
    secondsPerModule: 35 * 60,
    scaleMin: 200,
    scaleMax: 800,
    khanUrl: "https://www.khanacademy.org/test-prep/sat-math",
  },
  full: {
    label: "SAT",
    short: "SAT",
    questionsPerModule: 0,
    secondsPerModule: 0,
    scaleMin: 400,
    scaleMax: 1600,
    khanUrl: "https://www.khanacademy.org/test-prep/sat",
  },
};

export function answerKey(module: 1 | 2, index: number, section?: SatPart) {
  return section ? `${section}:m${module}q${index}` : `m${module}q${index}`;
}

export function emptySectionModules(): SatSectionModules {
  return { m1: [], m2: [] };
}

export function allQuestions(modules: SatModules | null | undefined): SatQuestion[] {
  if (!modules) return [];
  if (modules.rw || modules.math) {
    return [
      ...(modules.rw?.m1 || []),
      ...(modules.rw?.m2 || []),
      ...(modules.math?.m1 || []),
      ...(modules.math?.m2 || []),
    ];
  }
  return [...(modules.m1 || []), ...(modules.m2 || [])];
}

export function isFullSat(attempt: { section?: string; source?: string }) {
  return attempt.section === "full" || attempt.source === "bluebook";
}
