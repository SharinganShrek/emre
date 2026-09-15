import type { CollegeCounselingData } from "./types";
import { collegeCounselingData } from "./data";

/** Build a copyable Markdown counselor context pack from local counseling data. */
export function buildCounselorContextPack(
  data: CollegeCounselingData = collegeCounselingData,
): string {
  const {
    profile,
    overview,
    activities,
    research,
    schools,
    financial_aid,
    recommendations,
    counselor_todo,
  } = data;

  const gpaLines = profile.academic_records
    .map((r) => `- ${r.period}: ${r.gpa}${r.notes ? ` (${r.notes})` : ""}`)
    .join("\n");

  const testingLines = profile.testing
    .map((t) => {
      const result =
        t.score != null && t.score !== ""
          ? `score ${t.score}`
          : t.target
            ? t.target
            : "";
      return `- ${t.name}: ${t.status}${result ? ` — ${result}` : ""}`;
    })
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

  const recLines = recommendations
    .map(
      (r) =>
        `- ${r.name} (${r.subject_role}) — request: ${r.request_status}; brag sheet: ${r.brag_sheet_status}; can speak to: ${r.what_they_can_say}`,
    )
    .join("\n");

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

${schoolSummary("europe_main", "Europe Main Plan")}

## Financial aid constraints
- **Submission status:** ${financial_aid.submission_status}
${aidChecks}

### Notes (non-sensitive)
${financial_aid.notes}

### Next actions
${financial_aid.next_actions.map((a) => `- ${a}`).join("\n")}

## Recommendation status
${recLines}

## Counselor to-do
${counselor_todo?.trim() ? counselor_todo : "_Empty_"}

---
Applications tracked: ${overview.applications_tracked} · Financial aid status: ${overview.financial_aid_status}
`;
}

function priorityRank(p: "high" | "medium" | "low"): number {
  return p === "high" ? 0 : p === "medium" ? 1 : 2;
}
