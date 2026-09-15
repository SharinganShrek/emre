import { AiPermissionError } from "@/lib/ai/permissions";
import { uid } from "@/lib/utils";
import type {
  AcademicRecord,
  ActivityItem,
  CollegeCounselingData,
  RecommendationItem,
  ResearchProject,
  SchoolOption,
  TestPlanItem,
} from "./types";

export const COUNSELING_ITEM_SECTIONS = [
  "activities",
  "research",
  "schools",
  "recommendations",
  "testing",
  "academic_records",
] as const;

export type CounselingItemSection = (typeof COUNSELING_ITEM_SECTIONS)[number];

type Loose = Record<string, unknown>;

function asLoose(value: unknown): Loose {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Loose)
    : {};
}

function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableStr(value: unknown): string | null {
  if (value == null || value === "") return null;
  return str(value);
}

function priority(value: unknown): "high" | "medium" | "low" {
  return value === "high" || value === "low" ? value : "medium";
}

function draftStatus(value: unknown): "draft" | "needs_revision" | "ready" {
  return value === "needs_revision" || value === "ready" ? value : "draft";
}

import { normalizeSchoolGroup } from "./schools";

function activityFrom(raw: unknown, fallbackId?: string): ActivityItem {
  const r = asLoose(raw);
  return {
    id: str(r.id, fallbackId ?? uid("act")),
    title: str(r.title, "Untitled activity"),
    category: str(r.category, "Other"),
    role: str(r.role),
    organization: str(r.organization),
    grade_levels: str(r.grade_levels),
    hours_per_week: num(r.hours_per_week),
    weeks_per_year: num(r.weeks_per_year),
    common_app_description: str(r.common_app_description),
    expanded_description: str(r.expanded_description),
    impact_metrics: str(r.impact_metrics),
    evidence_link: nullableStr(r.evidence_link),
    priority: priority(r.priority),
    framing_notes: str(r.framing_notes),
    risk_notes: str(r.risk_notes),
    status: draftStatus(r.status),
  };
}

function researchFrom(raw: unknown, fallbackId?: string): ResearchProject {
  const r = asLoose(raw);
  return {
    id: str(r.id, fallbackId ?? uid("res")),
    title: str(r.title, "Untitled research"),
    field: str(r.field),
    mentor_institution: str(r.mentor_institution),
    dates: str(r.dates),
    methods: str(r.methods),
    dataset_material: str(r.dataset_material),
    output: str(r.output),
    publication_status: str(r.publication_status),
    my_role: str(r.my_role),
    what_this_proves: str(r.what_this_proves),
    next_step: str(r.next_step),
    link: nullableStr(r.link),
    category: str(r.category, "Research"),
  };
}

function schoolFrom(raw: unknown, fallbackId?: string): SchoolOption {
  const r = asLoose(raw);
  const reach =
    r.reach_severity === "extreme" ||
    r.reach_severity === "high" ||
    r.reach_severity === "moderate"
      ? r.reach_severity
      : "high";
  const aid =
    r.financial_viability === "strong" ||
    r.financial_viability === "risky" ||
    r.financial_viability === "poor"
      ? r.financial_viability
      : "risky";
  const value =
    r.strategic_value === "high" ||
    r.strategic_value === "medium" ||
    r.strategic_value === "low"
      ? r.strategic_value
      : "medium";
  const status =
    r.status === "researching" ||
    r.status === "applying" ||
    r.status === "submitted" ||
    r.status === "draft" ||
    r.status === "needs_revision" ||
    r.status === "ready"
      ? r.status
      : "researching";
  return {
    id: str(r.id, fallbackId ?? uid("sch")),
    school_name: str(r.school_name, "Untitled school"),
    country: str(r.country),
    program: str(r.program),
    application_system: str(r.application_system),
    deadline: str(r.deadline),
    financial_aid_type: str(r.financial_aid_type),
    financial_viability: aid,
    academic_fit: priority(r.academic_fit),
    narrative_fit: priority(r.narrative_fit),
    reach_severity: reach,
    strategic_value: value,
    status,
    notes: str(r.notes),
    group: normalizeSchoolGroup(r.group),
    requirements: Array.isArray(r.requirements)
      ? r.requirements.map((x) => str(x)).filter(Boolean)
      : [],
  };
}

function recFrom(raw: unknown, fallbackId?: string): RecommendationItem {
  const r = asLoose(raw);
  const request_status =
    r.request_status === "asked" ||
    r.request_status === "accepted" ||
    r.request_status === "submitted" ||
    r.request_status === "thanked" ||
    r.request_status === "not_asked"
      ? r.request_status
      : "not_asked";
  const brag =
    r.brag_sheet_status === "draft" ||
    r.brag_sheet_status === "needs_revision" ||
    r.brag_sheet_status === "ready" ||
    r.brag_sheet_status === "not_started"
      ? r.brag_sheet_status
      : "not_started";
  return {
    id: str(r.id, fallbackId ?? uid("rec")),
    name: str(r.name, "Untitled recommender"),
    subject_role: str(r.subject_role),
    relationship_strength: priority(r.relationship_strength),
    what_they_can_say: str(r.what_they_can_say),
    evidence_to_send: str(r.evidence_to_send),
    brag_sheet_status: brag,
    deadline: str(r.deadline),
    request_status,
    thank_you_status: r.thank_you_status === "sent" ? "sent" : "pending",
    notes: str(r.notes),
  };
}

function testingFrom(raw: unknown): TestPlanItem {
  const r = asLoose(raw);
  return {
    name: str(r.name, "Untitled exam"),
    status: str(r.status),
    score: r.score === undefined ? null : (r.score as TestPlanItem["score"]),
    target: r.target === undefined ? undefined : str(r.target),
    notes: r.notes === undefined ? undefined : str(r.notes),
  };
}

function recordFrom(raw: unknown): AcademicRecord {
  const r = asLoose(raw);
  return {
    period: str(r.period, "Untitled period"),
    gpa: num(r.gpa),
    notes: r.notes === undefined ? undefined : str(r.notes),
  };
}

function requireId(
  list: { id: string }[],
  id: string,
  label: string,
): number {
  const index = list.findIndex((row) => row.id === id);
  if (index < 0) {
    throw new AiPermissionError(`${label} "${id}" not found.`, 404);
  }
  return index;
}

export function addCounselingItem(
  current: CollegeCounselingData,
  section: CounselingItemSection,
  item: unknown,
): CollegeCounselingData {
  if (section === "testing") {
    const next = testingFrom(item);
    const key = next.name.trim().toLowerCase();
    if (current.profile.testing.some((t) => t.name.trim().toLowerCase() === key)) {
      throw new AiPermissionError(`Testing "${next.name}" already exists.`, 409);
    }
    return {
      ...current,
      profile: { ...current.profile, testing: [next, ...current.profile.testing] },
    };
  }
  if (section === "academic_records") {
    const next = recordFrom(item);
    if (current.profile.academic_records.some((r) => r.period === next.period)) {
      throw new AiPermissionError(
        `Academic record "${next.period}" already exists.`,
        409,
      );
    }
    return {
      ...current,
      profile: {
        ...current.profile,
        academic_records: [...current.profile.academic_records, next],
      },
    };
  }
  if (section === "activities") {
    const next = activityFrom(item);
    if (current.activities.some((a) => a.id === next.id)) {
      throw new AiPermissionError(`Activity id "${next.id}" already exists.`, 409);
    }
    return { ...current, activities: [next, ...current.activities] };
  }
  if (section === "research") {
    const next = researchFrom(item);
    if (current.research.some((a) => a.id === next.id)) {
      throw new AiPermissionError(`Research id "${next.id}" already exists.`, 409);
    }
    return { ...current, research: [next, ...current.research] };
  }
  if (section === "schools") {
    const next = schoolFrom(item);
    if (current.schools.some((a) => a.id === next.id)) {
      throw new AiPermissionError(`School id "${next.id}" already exists.`, 409);
    }
    return { ...current, schools: [next, ...current.schools] };
  }
  if (section === "recommendations") {
    const next = recFrom(item);
    if (current.recommendations.some((a) => a.id === next.id)) {
      throw new AiPermissionError(
        `Recommendation id "${next.id}" already exists.`,
        409,
      );
    }
    return { ...current, recommendations: [next, ...current.recommendations] };
  }
  throw new AiPermissionError(`Unknown counseling section "${section}".`, 400);
}

export function updateCounselingItem(
  current: CollegeCounselingData,
  section: CounselingItemSection,
  id: string,
  patch: unknown,
): CollegeCounselingData {
  const extra = asLoose(patch);
  if (section === "testing") {
    const key = id.trim().toLowerCase();
    const index = current.profile.testing.findIndex(
      (t) => t.name.trim().toLowerCase() === key,
    );
    if (index < 0) {
      throw new AiPermissionError(`Testing "${id}" not found.`, 404);
    }
    const merged = testingFrom({ ...current.profile.testing[index], ...extra });
    const testing = [...current.profile.testing];
    testing[index] = merged;
    return { ...current, profile: { ...current.profile, testing } };
  }
  if (section === "academic_records") {
    const index = current.profile.academic_records.findIndex(
      (r) => r.period === id,
    );
    if (index < 0) {
      throw new AiPermissionError(`Academic record "${id}" not found.`, 404);
    }
    const merged = recordFrom({
      ...current.profile.academic_records[index],
      ...extra,
    });
    const academic_records = [...current.profile.academic_records];
    academic_records[index] = merged;
    return { ...current, profile: { ...current.profile, academic_records } };
  }
  if (section === "activities") {
    const index = requireId(current.activities, id, "Activity");
    const next = [...current.activities];
    next[index] = activityFrom({ ...next[index], ...extra }, id);
    return { ...current, activities: next };
  }
  if (section === "research") {
    const index = requireId(current.research, id, "Research");
    const next = [...current.research];
    next[index] = researchFrom({ ...next[index], ...extra }, id);
    return { ...current, research: next };
  }
  if (section === "schools") {
    const index = requireId(current.schools, id, "School");
    const next = [...current.schools];
    next[index] = schoolFrom({ ...next[index], ...extra }, id);
    return { ...current, schools: next };
  }
  if (section === "recommendations") {
    const index = requireId(current.recommendations, id, "Recommendation");
    const next = [...current.recommendations];
    next[index] = recFrom({ ...next[index], ...extra }, id);
    return { ...current, recommendations: next };
  }
  throw new AiPermissionError(`Unknown counseling section "${section}".`, 400);
}

export function deleteCounselingItem(
  current: CollegeCounselingData,
  section: CounselingItemSection,
  id: string,
): CollegeCounselingData {
  if (section === "testing") {
    const key = id.trim().toLowerCase();
    const testing = current.profile.testing.filter(
      (t) => t.name.trim().toLowerCase() !== key,
    );
    if (testing.length === current.profile.testing.length) {
      throw new AiPermissionError(`Testing "${id}" not found.`, 404);
    }
    return { ...current, profile: { ...current.profile, testing } };
  }
  if (section === "academic_records") {
    const academic_records = current.profile.academic_records.filter(
      (r) => r.period !== id,
    );
    if (academic_records.length === current.profile.academic_records.length) {
      throw new AiPermissionError(`Academic record "${id}" not found.`, 404);
    }
    return { ...current, profile: { ...current.profile, academic_records } };
  }
  const drop = <T extends { id: string }>(list: T[], label: string): T[] => {
    const next = list.filter((row) => row.id !== id);
    if (next.length === list.length) {
      throw new AiPermissionError(`${label} "${id}" not found.`, 404);
    }
    return next;
  };
  if (section === "activities") {
    return { ...current, activities: drop(current.activities, "Activity") };
  }
  if (section === "research") {
    return { ...current, research: drop(current.research, "Research") };
  }
  if (section === "schools") {
    return { ...current, schools: drop(current.schools, "School") };
  }
  if (section === "recommendations") {
    return {
      ...current,
      recommendations: drop(current.recommendations, "Recommendation"),
    };
  }
  throw new AiPermissionError(`Unknown counseling section "${section}".`, 400);
}
