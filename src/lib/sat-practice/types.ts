export type SatSection = "rw" | "math";

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
}

export interface SatModules {
  m1: SatQuestion[];
  m2: SatQuestion[];
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
};

export function answerKey(module: 1 | 2, index: number) {
  return `m${module}q${index}`;
}
