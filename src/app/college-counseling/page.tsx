"use client";

import { useMemo, useState } from "react";
import {
  Copy,
  Download,
  RefreshCw,
  School,
  CheckSquare,
  AlertTriangle,
  Save,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hydrated } from "@/components/hydrated";
import {
  CollegeStatCard,
  CounselingSectionCard,
  MetaRow,
  PriorityBadge,
  StatusBadge,
} from "@/components/college-counseling/ui";
import { buildCounselorContextPack } from "@/lib/college-counseling/context-pack";
import {
  CounselingProvider,
  useCounseling,
} from "@/lib/college-counseling/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type {
  ActivityItem,
  EssayType,
  FinancialAidChecklist,
  SchoolOption,
  TimelineStatus,
} from "@/lib/college-counseling/types";

const TABS = [
  "Overview",
  "Profile",
  "Activities / CV",
  "Research Portfolio",
  "School List",
  "Timeline",
  "Essays",
  "Financial Aid",
  "Recommendations",
  "Weekly Check-ins",
  "AI Context Pack",
] as const;

type Tab = (typeof TABS)[number];

const PERIODS = [
  "Summer 2026",
  "Grade 11 Fall",
  "Grade 11 Spring",
  "Summer 2027",
  "Grade 12 Fall",
  "Grade 12 Spring",
] as const;

const ESSAY_SECTIONS: { type: EssayType; label: string }[] = [
  { type: "personal_statement", label: "Personal statement ideas" },
  { type: "why_major", label: "Why major notes" },
  { type: "why_school", label: "Why school notes" },
  { type: "intellectual_curiosity", label: "Intellectual curiosity stories" },
  { type: "leadership_community", label: "Leadership / community stories" },
  { type: "challenge_failure", label: "Challenge / failure stories" },
];

const TIMELINE_STATUSES: TimelineStatus[] = [
  "not_started",
  "in_progress",
  "done",
  "blocked",
];

export default function CollegeCounselingPage() {
  return (
    <Hydrated>
      <CounselingProvider>
        <CollegeCounseling />
      </CounselingProvider>
    </Hydrated>
  );
}

function CollegeCounseling() {
  const [tab, setTab] = useState<Tab>("Overview");
  const { data, loading, saving, dirty, source, save } = useCounseling();

  if (loading) {
    return (
      <p className="text-sm text-muted">Loading college counseling…</p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="College Counseling"
        description="Editable application strategy + copyable counselor context pack — no LLM calls."
        actions={
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            <Save />
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        }
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm transition-colors touch-manipulation",
              tab === t
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab />}
      {tab === "Profile" && <ProfileTab />}
      {tab === "Activities / CV" && <ActivitiesTab />}
      {tab === "Research Portfolio" && <ResearchTab />}
      {tab === "School List" && <SchoolsTab />}
      {tab === "Timeline" && <TimelineTab />}
      {tab === "Essays" && <EssaysTab />}
      {tab === "Financial Aid" && <FinancialAidTab />}
      {tab === "Recommendations" && <RecommendationsTab />}
      {tab === "Weekly Check-ins" && <CheckinsTab />}
      {tab === "AI Context Pack" && <ContextPackTab />}

      <p className="text-xs text-muted-2">
        {data.profile.full_name} · Class of {data.profile.graduation_year} ·{" "}
        {source === "supabase" ? "Synced to Supabase" : "Local browser storage"}
        {dirty ? " · unsaved changes" : ""}
      </p>
    </div>
  );
}

function OverviewTab() {
  const { data, setData } = useCounseling();
  const { profile, overview } = data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <CollegeStatCard label="Current grade" value={profile.current_grade} />
        <CollegeStatCard
          label="Graduation year"
          value={profile.graduation_year}
        />
        <CollegeStatCard
          label="Intended field"
          value="CS / Applied AI"
          hint={profile.intended_fields.join(" · ")}
        />
        <CollegeStatCard label="SAT target" value={overview.sat_target} />
        <CollegeStatCard label="GPA average" value={overview.gpa_average} />
        <CollegeStatCard label="Next priority" value={overview.next_priority} />
        <CollegeStatCard
          label="Applications tracked"
          value={overview.applications_tracked}
        />
        <CollegeStatCard
          label="Essays drafted"
          value={overview.essays_drafted}
        />
        <CollegeStatCard
          label="Financial aid status"
          value={overview.financial_aid_status}
        />
        <CollegeStatCard
          label="Counselor readiness"
          value={`${overview.counselor_readiness_score}/100`}
          hint="Local heuristic, not an AI score"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CounselingSectionCard title="Current strategic diagnosis">
          <Textarea
            value={overview.strategic_diagnosis}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                overview: {
                  ...prev.overview,
                  strategic_diagnosis: e.target.value,
                },
              }))
            }
            className="min-h-28"
          />
        </CounselingSectionCard>
        <CounselingSectionCard title="Current positioning">
          <Textarea
            value={overview.current_positioning}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                overview: {
                  ...prev.overview,
                  current_positioning: e.target.value,
                },
              }))
            }
            className="min-h-28"
          />
        </CounselingSectionCard>
        <CounselingSectionCard title="Next priority">
          <Input
            value={overview.next_priority}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                overview: { ...prev.overview, next_priority: e.target.value },
              }))
            }
          />
        </CounselingSectionCard>
        <CounselingSectionCard title="Financial aid status (summary)">
          <Input
            value={overview.financial_aid_status}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                overview: {
                  ...prev.overview,
                  financial_aid_status: e.target.value,
                },
              }))
            }
          />
        </CounselingSectionCard>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { data, setData } = useCounseling();
  const p = data.profile;

  function updateProfile<K extends keyof typeof p>(key: K, value: (typeof p)[K]) {
    setData((prev) => ({
      ...prev,
      profile: { ...prev.profile, [key]: value },
    }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CounselingSectionCard title="Basic identity">
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={p.full_name}
              onChange={(e) => updateProfile("full_name", e.target.value)}
            />
          </div>
          <div>
            <Label>School</Label>
            <Input
              value={p.school}
              onChange={(e) => updateProfile("school", e.target.value)}
            />
          </div>
          <div>
            <Label>Country</Label>
            <Input
              value={p.country}
              onChange={(e) => updateProfile("country", e.target.value)}
            />
          </div>
          <div>
            <Label>Grade</Label>
            <Input
              value={p.current_grade}
              onChange={(e) => updateProfile("current_grade", e.target.value)}
            />
          </div>
          <div>
            <Label>Graduation year</Label>
            <Input
              type="number"
              value={p.graduation_year}
              onChange={(e) =>
                updateProfile("graduation_year", Number(e.target.value) || 0)
              }
            />
          </div>
          <div>
            <Label>Citizenship (comma-separated)</Label>
            <Input
              value={p.citizenship.join(", ")}
              onChange={(e) =>
                updateProfile(
                  "citizenship",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </div>
        </div>
      </CounselingSectionCard>

      <CounselingSectionCard title="Academic profile">
        <ul className="space-y-2">
          {p.academic_records.map((r) => (
            <li
              key={r.period}
              className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"
            >
              <span>{r.period}</span>
              <span className="font-medium">{r.gpa}</span>
            </li>
          ))}
        </ul>
      </CounselingSectionCard>

      <CounselingSectionCard title="Testing">
        <ul className="space-y-2">
          {p.testing.map((t) => (
            <li key={t.name} className="rounded-lg bg-surface-2 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t.name}</span>
                <Badge variant="default">{t.status}</Badge>
              </div>
              {t.target && (
                <p className="mt-1 text-xs text-muted">{t.target}</p>
              )}
            </li>
          ))}
        </ul>
      </CounselingSectionCard>

      <CounselingSectionCard title="Intended majors">
        <div>
          <Label>Fields (comma-separated)</Label>
          <Input
            value={p.intended_fields.join(", ")}
            onChange={(e) =>
              updateProfile(
                "intended_fields",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>
        <div className="mt-3">
          <Label>Positioning idea</Label>
          <Textarea
            value={p.positioning_idea}
            onChange={(e) => updateProfile("positioning_idea", e.target.value)}
            rows={3}
          />
        </div>
      </CounselingSectionCard>

      <CounselingSectionCard title="Strategies">
        <div className="space-y-3">
          <div>
            <Label>US strategy</Label>
            <Textarea
              value={p.us_strategy}
              onChange={(e) => updateProfile("us_strategy", e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label>Europe strategy</Label>
            <Textarea
              value={p.europe_strategy}
              onChange={(e) => updateProfile("europe_strategy", e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </CounselingSectionCard>

      <CounselingSectionCard title="Constraints (one per line)">
        <Textarea
          value={p.constraints.join("\n")}
          onChange={(e) =>
            updateProfile(
              "constraints",
              e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
            )
          }
          rows={5}
        />
      </CounselingSectionCard>

      <CounselingSectionCard title="Preferences (one per line)">
        <Textarea
          value={p.preferences.join("\n")}
          onChange={(e) =>
            updateProfile(
              "preferences",
              e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
            )
          }
          rows={5}
        />
      </CounselingSectionCard>

      <CounselingSectionCard
        title="Positioning statements"
        className="lg:col-span-2"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["one_line", "One-line"],
              ["common_app_bio", "Common App bio"],
              ["research_heavy", "Research-heavy"],
              ["europe_technical", "Europe technical"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Textarea
                value={p.positioning[key]}
                onChange={(e) =>
                  setData((prev) => ({
                    ...prev,
                    profile: {
                      ...prev.profile,
                      positioning: {
                        ...prev.profile.positioning,
                        [key]: e.target.value,
                      },
                    },
                  }))
                }
                rows={2}
              />
            </div>
          ))}
        </div>
      </CounselingSectionCard>
    </div>
  );
}

function ActivitiesTab() {
  const { data, setData } = useCounseling();
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  const categories = useMemo(
    () => Array.from(new Set(data.activities.map((a) => a.category))).sort(),
    [data.activities],
  );

  const filtered = data.activities.filter((a) => {
    if (category !== "all" && a.category !== category) return false;
    if (status !== "all" && a.status !== status) return false;
    if (priority !== "all" && a.priority !== priority) return false;
    return true;
  });

  function updateActivity(id: string, patch: Partial<ActivityItem>) {
    setData((prev) => ({
      ...prev,
      activities: prev.activities.map((a) =>
        a.id === id ? { ...a, ...patch } : a,
      ),
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-auto min-w-[160px]"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-auto min-w-[140px]"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="needs_revision">Needs revision</option>
          <option value="ready">Ready</option>
        </Select>
        <Select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-auto min-w-[130px]"
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((a) => (
          <ActivityCard
            key={a.id}
            activity={a}
            onChange={(patch) => updateActivity(a.id, patch)}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityCard({
  activity: a,
  onChange,
}: {
  activity: ActivityItem;
  onChange: (patch: Partial<ActivityItem>) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{a.title}</CardTitle>
          <p className="mt-1 text-xs text-muted-2">
            {a.role} · {a.organization}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <PriorityBadge priority={a.priority} />
          <StatusBadge status={a.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted">{a.common_app_description}</p>
        <p className="text-xs text-muted-2">
          Grades {a.grade_levels} · {a.hours_per_week} hr/wk · {a.weeks_per_year}{" "}
          wk/yr · {a.category}
        </p>
        <div>
          <Label>Status</Label>
          <Select
            value={a.status}
            onChange={(e) =>
              onChange({ status: e.target.value as ActivityItem["status"] })
            }
          >
            <option value="draft">Draft</option>
            <option value="needs_revision">Needs revision</option>
            <option value="ready">Ready</option>
          </Select>
        </div>
        <div>
          <Label>Framing notes</Label>
          <Textarea
            value={a.framing_notes}
            onChange={(e) => onChange({ framing_notes: e.target.value })}
            rows={2}
          />
        </div>
        <div>
          <Label>Evidence link</Label>
          <Input
            value={a.evidence_link ?? ""}
            onChange={(e) =>
              onChange({ evidence_link: e.target.value || null })
            }
            placeholder="https://…"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ResearchTab() {
  const { data, setData } = useCounseling();
  const { research, research_narrative } = data;

  return (
    <div className="space-y-4">
      <CounselingSectionCard title="Research narrative">
        <Textarea
          value={research_narrative}
          onChange={(e) =>
            setData((prev) => ({
              ...prev,
              research_narrative: e.target.value,
            }))
          }
          className="min-h-28"
        />
      </CounselingSectionCard>
      <div className="grid gap-4 lg:grid-cols-2">
        {research.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{r.title}</CardTitle>
                <Badge variant="accent">{r.category}</Badge>
              </div>
              <p className="text-xs text-muted-2">
                {r.mentor_institution} · {r.dates}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="space-y-2">
                <MetaRow label="Field" value={r.field} />
                <MetaRow label="Methods" value={r.methods} />
                <MetaRow label="Output" value={r.output} />
                <MetaRow label="Publication" value={r.publication_status} />
                <MetaRow label="My role" value={r.my_role} />
              </dl>
              <div>
                <Label>Next step</Label>
                <Textarea
                  value={r.next_step}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      research: prev.research.map((item) =>
                        item.id === r.id
                          ? { ...item, next_step: e.target.value }
                          : item,
                      ),
                    }))
                  }
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SchoolsTab() {
  const { data, setData } = useCounseling();
  const groups: { key: SchoolOption["group"]; title: string }[] = [
    {
      key: "us_need_blind",
      title: "US Need-Blind / Full-Need (verify annually)",
    },
    {
      key: "us_need_aware",
      title: "US Need-Aware but Worth Considering",
    },
    { key: "europe_main", title: "Europe Main Plan" },
  ];

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const rows = data.schools.filter((s) => s.group === g.key);
        return (
          <section key={g.key} className="space-y-3">
            <h2 className="text-sm font-semibold">{g.title}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {rows.map((s) => (
                <Card key={s.id}>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{s.school_name}</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-2">
                        {s.country} · {s.program}
                      </p>
                    </div>
                    <School className="size-4 shrink-0 text-muted-2" />
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="default">reach: {s.reach_severity}</Badge>
                      <Badge variant="accent">value: {s.strategic_value}</Badge>
                      <Badge
                        variant={
                          s.financial_viability === "strong"
                            ? "success"
                            : s.financial_viability === "risky"
                              ? "warning"
                              : "danger"
                        }
                      >
                        aid: {s.financial_viability}
                      </Badge>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={s.status}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            schools: prev.schools.map((row) =>
                              row.id === s.id
                                ? {
                                    ...row,
                                    status: e.target
                                      .value as SchoolOption["status"],
                                  }
                                : row,
                            ),
                          }))
                        }
                      >
                        <option value="researching">Researching</option>
                        <option value="draft">Draft</option>
                        <option value="needs_revision">Needs revision</option>
                        <option value="ready">Ready</option>
                        <option value="applying">Applying</option>
                        <option value="submitted">Submitted</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        value={s.notes}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            schools: prev.schools.map((row) =>
                              row.id === s.id
                                ? { ...row, notes: e.target.value }
                                : row,
                            ),
                          }))
                        }
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TimelineTab() {
  const { data, setData } = useCounseling();

  return (
    <div className="space-y-6">
      {PERIODS.map((period) => {
        const items = data.timeline.filter((t) => t.period === period);
        if (items.length === 0) return null;
        return (
          <section key={period}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-2">
              {period}
            </h2>
            <div className="space-y-2">
              {items.map((t) => (
                <Card key={t.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted">
                        {t.category} · {t.deadline}
                      </p>
                      <Textarea
                        value={t.notes}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            timeline: prev.timeline.map((row) =>
                              row.id === t.id
                                ? { ...row, notes: e.target.value }
                                : row,
                            ),
                          }))
                        }
                        rows={2}
                      />
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <PriorityBadge priority={t.priority} />
                      <Select
                        value={t.status}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            timeline: prev.timeline.map((row) =>
                              row.id === t.id
                                ? {
                                    ...row,
                                    status: e.target.value as TimelineStatus,
                                  }
                                : row,
                            ),
                          }))
                        }
                        className="w-auto min-w-[140px]"
                      >
                        {TIMELINE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replaceAll("_", " ")}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EssaysTab() {
  const { data, setData } = useCounseling();
  const essays = data.essays;

  return (
    <div className="space-y-6">
      {ESSAY_SECTIONS.map((section) => {
        const items = essays.filter((e) => e.essay_type === section.type);
        return (
          <section key={section.type} className="space-y-3">
            <h2 className="text-sm font-semibold">{section.label}</h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted-2">No ideas tagged yet.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {items.map((e) => (
                  <Card key={e.id}>
                    <CardHeader className="flex-row items-start justify-between gap-2">
                      <CardTitle className="text-base">{e.title}</CardTitle>
                      <Select
                        value={e.status}
                        onChange={(ev) =>
                          setData((prev) => ({
                            ...prev,
                            essays: prev.essays.map((row) =>
                              row.id === e.id
                                ? {
                                    ...row,
                                    status: ev.target
                                      .value as (typeof e)["status"],
                                  }
                                : row,
                            ),
                          }))
                        }
                        className="w-auto"
                      >
                        <option value="draft">Draft</option>
                        <option value="needs_revision">Needs revision</option>
                        <option value="ready">Ready</option>
                      </Select>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>
                        <span className="text-xs text-muted-2">Story: </span>
                        {e.core_story}
                      </p>
                      <p>
                        <span className="text-xs text-muted-2">Shows: </span>
                        {e.what_it_shows}
                      </p>
                      <div>
                        <Label>Draft notes</Label>
                        <Textarea
                          value={e.draft_notes}
                          onChange={(ev) =>
                            setData((prev) => ({
                              ...prev,
                              essays: prev.essays.map((row) =>
                                row.id === e.id
                                  ? { ...row, draft_notes: ev.target.value }
                                  : row,
                              ),
                            }))
                          }
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FinancialAidTab() {
  const { data, setData } = useCounseling();
  const f = data.financial_aid;

  const checks: {
    key: keyof FinancialAidChecklist;
    label: string;
  }[] = [
    { key: "css_profile_required", label: "CSS Profile required?" },
    {
      key: "noncustodial_form_required",
      label: "Noncustodial parent form required?",
    },
    {
      key: "noncustodial_waiver_needed",
      label: "Noncustodial waiver needed?",
    },
    {
      key: "income_documents_collected",
      label: "Income documents collected?",
    },
    { key: "translations_needed", label: "Translations needed?" },
    { key: "bank_statements_needed", label: "Bank statements needed?" },
    { key: "school_specific_forms", label: "School-specific forms?" },
  ];

  function toggle(key: keyof FinancialAidChecklist) {
    const current = f[key];
    if (typeof current !== "boolean") return;
    setData((prev) => ({
      ...prev,
      financial_aid: { ...prev.financial_aid, [key]: !current },
    }));
  }

  return (
    <div className="space-y-4">
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex gap-3 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          <p className="text-sm text-muted">
            Store only document status and non-sensitive notes here. Keep actual
            financial documents outside Emre Hub. Do not upload IDs, bank files,
            or salary documents into this app.
          </p>
        </CardContent>
      </Card>

      <CounselingSectionCard title="Checklist (status only)">
        <ul className="space-y-2">
          {checks.map(({ key, label }) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => toggle(key)}
                className="flex w-full items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5 text-left text-sm touch-manipulation"
              >
                <span>{label}</span>
                <Badge variant={f[key] ? "success" : "default"}>
                  {f[key] ? "Yes" : "No"}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-3 pt-2">
          <div>
            <Label>Submission status</Label>
            <Input
              value={f.submission_status}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  financial_aid: {
                    ...prev.financial_aid,
                    submission_status: e.target.value,
                  },
                }))
              }
            />
          </div>
          <div>
            <Label>Notes (non-sensitive)</Label>
            <Textarea
              value={f.notes}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  financial_aid: {
                    ...prev.financial_aid,
                    notes: e.target.value,
                  },
                }))
              }
              rows={3}
            />
          </div>
          <div>
            <Label>Next actions (one per line)</Label>
            <Textarea
              value={f.next_actions.join("\n")}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  financial_aid: {
                    ...prev.financial_aid,
                    next_actions: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                }))
              }
              rows={4}
            />
          </div>
        </div>
      </CounselingSectionCard>
    </div>
  );
}

function RecommendationsTab() {
  const { data, setData, patch } = useCounseling();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {data.recommendations.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="text-base">{r.name}</CardTitle>
              <p className="text-xs text-muted-2">{r.subject_role}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-1">
                <PriorityBadge priority={r.relationship_strength} />
              </div>
              <div>
                <Label>Request status</Label>
                <Select
                  value={r.request_status}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      recommendations: prev.recommendations.map((row) =>
                        row.id === r.id
                          ? {
                              ...row,
                              request_status: e.target
                                .value as (typeof r)["request_status"],
                            }
                          : row,
                      ),
                    }))
                  }
                >
                  <option value="not_asked">Not asked</option>
                  <option value="asked">Asked</option>
                  <option value="accepted">Accepted</option>
                  <option value="submitted">Submitted</option>
                  <option value="thanked">Thanked</option>
                </Select>
              </div>
              <MetaRow label="Can say" value={r.what_they_can_say} />
              <MetaRow label="Deadline" value={r.deadline} />
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={r.notes}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      recommendations: prev.recommendations.map((row) =>
                        row.id === r.id
                          ? { ...row, notes: e.target.value }
                          : row,
                      ),
                    }))
                  }
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CounselingSectionCard title="Brag Sheet Builder">
        <Label>Working notes</Label>
        <Textarea
          value={data.brag_sheet_notes}
          onChange={(e) => patch("brag_sheet_notes", e.target.value)}
          className="min-h-32"
        />
        <p className="text-xs text-muted-2">
          Persisted with Save (Supabase or local storage).
        </p>
      </CounselingSectionCard>
    </div>
  );
}

function CheckinsTab() {
  const { data, setData } = useCounseling();
  const [form, setForm] = useState({
    week_date: new Date().toISOString().slice(0, 10),
    what_i_did: "",
    what_i_missed: "",
    biggest_progress: "",
    biggest_concern: "",
    new_achievement: "",
    new_deadline: "",
    question_for_counselor: "",
    next_week_priorities: "",
  });

  function saveDraft() {
    setData((prev) => ({
      ...prev,
      weekly_checkins: [
        {
          id: crypto.randomUUID(),
          ...form,
          status: "draft",
        },
        ...prev.weekly_checkins,
      ],
    }));
    toast.success("Check-in added — click Save changes to persist");
    setForm((f) => ({
      ...f,
      what_i_did: "",
      what_i_missed: "",
      biggest_progress: "",
      biggest_concern: "",
      new_achievement: "",
      new_deadline: "",
      question_for_counselor: "",
      next_week_priorities: "",
    }));
  }

  return (
    <div className="space-y-6">
      <CounselingSectionCard title="New weekly check-in">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Week date</Label>
            <Input
              type="date"
              value={form.week_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, week_date: e.target.value }))
              }
            />
          </div>
          {(
            [
              ["what_i_did", "What I did"],
              ["what_i_missed", "What I missed"],
              ["biggest_progress", "Biggest progress"],
              ["biggest_concern", "Biggest concern"],
              ["new_achievement", "New achievement"],
              ["new_deadline", "New deadline"],
              ["question_for_counselor", "Question for counselor"],
              ["next_week_priorities", "Next week priorities"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="sm:col-span-2">
              <Label>{label}</Label>
              <Textarea
                value={form[key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
                rows={2}
              />
            </div>
          ))}
        </div>
        <Button size="sm" onClick={saveDraft}>
          <CheckSquare /> Add draft
        </Button>
      </CounselingSectionCard>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Recent check-ins</h2>
        {data.weekly_checkins.map((w) => (
          <Card key={w.id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Week of {w.week_date}</CardTitle>
              <StatusBadge status={w.status} />
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-xs text-muted-2">Did: </span>
                {w.what_i_did}
              </p>
              <p>
                <span className="text-xs text-muted-2">Missed: </span>
                {w.what_i_missed}
              </p>
              <p>
                <span className="text-xs text-muted-2">Progress: </span>
                {w.biggest_progress}
              </p>
              <p>
                <span className="text-xs text-muted-2">Concern: </span>
                {w.biggest_concern}
              </p>
              <p className="sm:col-span-2">
                <span className="text-xs text-muted-2">Question: </span>
                {w.question_for_counselor}
              </p>
              <p className="sm:col-span-2">
                <span className="text-xs text-muted-2">Next: </span>
                {w.next_week_priorities}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ContextPackTab() {
  const { data } = useCounseling();
  const [pack, setPack] = useState(() => buildCounselorContextPack(data));

  async function copy() {
    try {
      await navigator.clipboard.writeText(pack);
      toast.success("Context pack copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  function download() {
    const blob = new Blob([pack], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emre-counselor-context-pack-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download started");
  }

  return (
    <div className="space-y-4">
      <CounselingSectionCard
        title="Counselor Context Pack"
        description="Formats your saved counseling data into Markdown. Does not call any LLM."
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void copy()}>
            <Copy /> Copy to clipboard
          </Button>
          <Button size="sm" variant="secondary" onClick={download}>
            <Download /> Download .md
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPack(buildCounselorContextPack(data));
              toast.message("Context pack refreshed from current data");
            }}
          >
            <RefreshCw /> Refresh
          </Button>
        </div>
        <Textarea
          value={pack}
          onChange={(e) => setPack(e.target.value)}
          className="min-h-[480px] font-mono text-xs leading-relaxed"
        />
      </CounselingSectionCard>
    </div>
  );
}
