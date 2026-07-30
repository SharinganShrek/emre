import type { CollegeCounselingData } from "./types";
import { collegeCounselingData } from "./data";

/** Build a copyable Markdown counselor context pack from local counseling data. */
export function buildCounselorContextPack(
  data: CollegeCounselingData = collegeCounselingData,
): string {
  const { profile, overview, activities, research, schools, timeline, essays, financial_aid, recommendations, weekly_checkins } =
    data;

  const gpaLines = profile.academic_records
    .map((r) => `- ${r.period}: ${r.gpa}${r.notes ? ` (${r.notes})` : ""}`)
    .join("\n");

  const testingLines = profile.testing
    .map((t) => `- ${t.name}: ${t.status}${t.target ? ` — ${t.target}` : ""}`)
    .join("\n");

  const topActivities = [...activities]
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .slice(0, 8)
    .map(
      (a) =>
        `- **${a.title}** (${a.role}, ${a.organization}) — ${a.common_app_description} [priority: ${a.priority}; status: ${a.status}]`,
    )
    .join("\n");

  const researchLines = research
    .map(
      (r) =>
        `- **${r.title}** (${r.field}) @ ${r.mentor_institution} — role: ${r.my_role}; output: ${r.output}; status: ${r.publication_status}`,
    )
    .join("\n");

  const schoolSummary = (group: typeof schools[number]["group"], label: string) => {
    const rows = schools.filter((s) => s.group === group);
    return `### ${label} (${rows.length})\n${rows
      .map(
        (s) =>
          `- ${s.school_name} — ${s.program}; reach: ${s.reach_severity}; aid fit: ${s.financial_viability}; strategic value: ${s.strategic_value}`,
      )
      .join("\n")}`;
  };

  const openTimeline = timeline
    .filter((t) => t.status !== "done")
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .slice(0, 10)
    .map((t) => `- [${t.period}] ${t.title} (${t.priority}, ${t.status}) — ${t.notes}`)
    .join("\n");

  const essayLines = essays
    .map(
      (e) =>
        `- **${e.title}** (${e.essay_type}) — shows: ${e.what_it_shows}; risk: ${e.risks}; status: ${e.status}`,
    )
    .join("\n");

  const recLines = recommendations
    .map(
      (r) =>
        `- ${r.name} (${r.subject_role}) — request: ${r.request_status}; brag sheet: ${r.brag_sheet_status}; can speak to: ${r.what_they_can_say}`,
    )
    .join("\n");

  const checkins = [...weekly_checkins]
    .sort((a, b) => b.week_date.localeCompare(a.week_date))
    .slice(0, 4)
    .map(
      (w) =>
        `### Week of ${w.week_date}\n- Did: ${w.what_i_did}\n- Missed: ${w.what_i_missed}\n- Progress: ${w.biggest_progress}\n- Concern: ${w.biggest_concern}\n- Question: ${w.question_for_counselor}\n- Next: ${w.next_week_priorities}`,
    )
    .join("\n\n");

  const aidChecks = [
    ["CSS Profile required", financial_aid.css_profile_required],
    ["Noncustodial form required", financial_aid.noncustodial_form_required],
    ["Noncustodial waiver needed", financial_aid.noncustodial_waiver_needed],
    ["Income docs collected", financial_aid.income_documents_collected],
    ["Translations needed", financial_aid.translations_needed],
    ["Bank statements needed", financial_aid.bank_statements_needed],
    ["School-specific forms", financial_aid.school_specific_forms],
  ]
    .map(([label, yes]) => `- ${label}: ${yes ? "yes" : "no"}`)
    .join("\n");

  return `# Counselor Context Pack — ${profile.full_name}

_Generated from Emre Hub College Counseling. No LLM involved._

## Student snapshot
- **Name:** ${profile.full_name}
- **School:** ${profile.school}, ${profile.country}
- **Grade:** ${profile.current_grade} (grad ${profile.graduation_year})
- **Citizenship:** ${profile.citizenship.join("; ")}
- **Intended fields:** ${profile.intended_fields.join(", ")}
- **SAT target:** ${overview.sat_target}
- **GPA average (sample):** ${overview.gpa_average}
- **Next priority:** ${overview.next_priority}
- **Counselor readiness score:** ${overview.counselor_readiness_score}/100

## Strategic diagnosis
${overview.strategic_diagnosis}

## Positioning
${overview.current_positioning}

### Positioning variants
- **One-line:** ${profile.positioning.one_line}
- **Common App bio:** ${profile.positioning.common_app_bio}
- **Research-heavy:** ${profile.positioning.research_heavy}
- **Europe technical:** ${profile.positioning.europe_technical}

## Academic profile
${gpaLines}

## Testing status
${testingLines}

## Constraints & preferences
### Constraints
${profile.constraints.map((c) => `- ${c}`).join("\n")}

### Preferences
${profile.preferences.map((p) => `- ${p}`).join("\n")}

## Activities summary (priority-sorted)
${topActivities}

## Research portfolio
${researchLines}

### Research narrative
${data.research_narrative}

## School list summary
${schoolSummary("us_need_blind", "US Need-Blind / Full-Need (verify annually)")}

${schoolSummary("us_need_aware", "US Need-Aware but Worth Considering")}

${schoolSummary("europe_main", "Europe Main Plan")}

## Financial aid constraints
- **Submission status:** ${financial_aid.submission_status}
${aidChecks}

### Notes (non-sensitive)
${financial_aid.notes}

### Next actions
${financial_aid.next_actions.map((a) => `- ${a}`).join("\n")}

## Current timeline priorities
${openTimeline}

## Essay ideas
${essayLines}

## Recommendation status
${recLines}

## Recent weekly check-ins
${checkins}

## Open questions for counselor
${weekly_checkins
  .map((w) => `- (${w.week_date}) ${w.question_for_counselor}`)
  .join("\n")}

---
Applications tracked: ${overview.applications_tracked} · Essays drafted: ${overview.essays_drafted} · Financial aid status: ${overview.financial_aid_status}
`;
}

function priorityRank(p: "high" | "medium" | "low"): number {
  return p === "high" ? 0 : p === "medium" ? 1 : 2;
}
