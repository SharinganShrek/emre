/** College Counseling domain types (persisted via college_counseling.payload). */

export type Priority = "high" | "medium" | "low";
export type DraftStatus = "draft" | "needs_revision" | "ready";
export type ReachSeverity = "extreme" | "high" | "moderate";
export type StrategicValue = "high" | "medium" | "low";
export type FinancialViability = "strong" | "risky" | "poor";
export type TimelineStatus = "not_started" | "in_progress" | "done" | "blocked";
export type RequestStatus =
  | "not_asked"
  | "asked"
  | "accepted"
  | "submitted"
  | "thanked";

export interface AcademicRecord {
  period: string;
  gpa: number;
  notes?: string;
}

export interface TestPlanItem {
  name: string;
  status: string;
  target?: string;
  notes?: string;
}

export interface PositioningStatements {
  one_line: string;
  common_app_bio: string;
  research_heavy: string;
  europe_technical: string;
}

export interface CollegeProfile {
  full_name: string;
  school: string;
  country: string;
  current_grade: string;
  graduation_year: number;
  citizenship: string[];
  intended_fields: string[];
  positioning_idea: string;
  us_strategy: string;
  europe_strategy: string;
  academic_records: AcademicRecord[];
  testing: TestPlanItem[];
  constraints: string[];
  preferences: string[];
  positioning: PositioningStatements;
}

export interface ActivityItem {
  id: string;
  title: string;
  category: string;
  role: string;
  organization: string;
  grade_levels: string;
  hours_per_week: number;
  weeks_per_year: number;
  common_app_description: string;
  expanded_description: string;
  impact_metrics: string;
  evidence_link: string | null;
  priority: Priority;
  framing_notes: string;
  risk_notes: string;
  status: DraftStatus;
}

export interface ResearchProject {
  id: string;
  title: string;
  field: string;
  mentor_institution: string;
  dates: string;
  methods: string;
  dataset_material: string;
  output: string;
  publication_status: string;
  my_role: string;
  what_this_proves: string;
  next_step: string;
  link: string | null;
  category: string;
}

export interface SchoolOption {
  id: string;
  school_name: string;
  country: string;
  program: string;
  application_system: string;
  deadline: string;
  financial_aid_type: string;
  financial_viability: FinancialViability;
  academic_fit: Priority;
  narrative_fit: Priority;
  reach_severity: ReachSeverity;
  strategic_value: StrategicValue;
  status: DraftStatus | "researching" | "applying" | "submitted";
  notes: string;
  group: "us_need_blind" | "us_need_aware" | "europe_main";
  requirements: string[];
}

export interface TimelineItem {
  id: string;
  title: string;
  category: string;
  period: string;
  deadline: string;
  priority: Priority;
  status: TimelineStatus;
  notes: string;
}

export type EssayType =
  | "personal_statement"
  | "why_major"
  | "why_school"
  | "intellectual_curiosity"
  | "leadership_community"
  | "challenge_failure";

export interface EssayIdea {
  id: string;
  title: string;
  essay_type: EssayType;
  core_story: string;
  what_it_shows: string;
  risks: string;
  best_fit: string;
  status: DraftStatus;
  draft_notes: string;
}

export interface FinancialAidChecklist {
  css_profile_required: boolean;
  noncustodial_form_required: boolean;
  noncustodial_waiver_needed: boolean;
  income_documents_collected: boolean;
  translations_needed: boolean;
  bank_statements_needed: boolean;
  school_specific_forms: boolean;
  submission_status: string;
  notes: string;
  next_actions: string[];
}

export interface RecommendationItem {
  id: string;
  name: string;
  subject_role: string;
  relationship_strength: Priority;
  what_they_can_say: string;
  evidence_to_send: string;
  brag_sheet_status: DraftStatus | "not_started";
  deadline: string;
  request_status: RequestStatus;
  thank_you_status: "pending" | "sent";
  notes: string;
}

export interface WeeklyCheckIn {
  id: string;
  week_date: string;
  what_i_did: string;
  what_i_missed: string;
  biggest_progress: string;
  biggest_concern: string;
  new_achievement: string;
  new_deadline: string;
  question_for_counselor: string;
  next_week_priorities: string;
  status: "draft" | "shared";
}

export interface OverviewStats {
  next_priority: string;
  applications_tracked: number;
  essays_drafted: number;
  financial_aid_status: string;
  counselor_readiness_score: number;
  strategic_diagnosis: string;
  current_positioning: string;
  gpa_average: number;
  sat_target: string;
}

export interface CollegeCounselingData {
  /** Bump when seed activity copy should overwrite matching ids once. */
  activities_seed_rev?: number;
  profile: CollegeProfile;
  overview: OverviewStats;
  activities: ActivityItem[];
  research: ResearchProject[];
  research_narrative: string;
  schools: SchoolOption[];
  timeline: TimelineItem[];
  essays: EssayIdea[];
  financial_aid: FinancialAidChecklist;
  recommendations: RecommendationItem[];
  brag_sheet_notes: string;
  weekly_checkins: WeeklyCheckIn[];
}
