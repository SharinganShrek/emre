# Custom GPT Knowledge — payload recipes

Upload this file in **Create a GPT → Knowledge**. Do not paste it into Instructions.
Instructions stay short; this file has the JSON shapes.

Never invent words, plan_ids, activity text, or scores. Always GET live data first.

## SAT Vocab (`updateSatVocabProgress`)

Learn:
`{"action":"learn","plan_id":"plan-001","known_words":["cadence"]}`

In-chat quiz:
`{"action":"test","plan_id":"plan-001","drill":"mixed","score":85,"results":[{"word":"cadence","correct":true,"chosen":"rhythm of a sequence","expected":"rhythm of a sequence"},{"word":"abate","correct":false,"chosen":"to increase suddenly","expected":"to lessen"}]}`

Sunday rest: `{"action":"rest","plan_id":"plan-007"}`

Extra quiz (does not complete a day):
`{"action":"word_results","results":[{"word":"cadence","correct":false,"chosen":"hidden meaning","expected":"rhythm of a sequence"}]}`

In-app mixed test (`send_test` replaces any queued test for that session):
```
{
  "action": "send_test",
  "plan_id": "plan-001",
  "title": "Week 1 learn 1",
  "test": {
    "format": "mixed",
    "items": [
      {"kind":"multiple_choice","word":"cadence","prompt":"The cadence of the speech lulled the crowd.","choices":["rhythm of a sequence","sudden anger","a kind of bird","hidden meaning"],"answer":"rhythm of a sequence"},
      {"kind":"type_word","word":"cadence","prompt":"the rhythmic flow or sequence of sounds","accepted":["cadence"]},
      {"kind":"type_definition","word":"abate","prompt":"abate","accepted":["lessen","reduce","azalmak"]}
    ]
  }
}
```

Item shapes:
- multiple_choice: `word`, `prompt`, `choices`, `answer` (choice text or 0-based index)
- type_word: `word`, `prompt` (definition shown), `accepted[]`
- type_definition: `word`, `prompt` (word shown), `accepted[]`
- matching: `word`, `definition` (own format, not mixed; ≥2 pairs)

1–200 items. Mixed needs ≥2 kinds. Use only words from that session. Rephrase catalog text when you can.

## Review test (`send_review_test`)

Not tied to a plan day. Omit `plan_id`. No item cap. It shows under SAT Vocab → Weak Words, not on a session card. Do not mark a plan day complete.

```
{
  "action": "send_review_test",
  "title": "Weak words mixed",
  "test": {
    "format": "mixed",
    "items": [
      {"kind":"multiple_choice","word":"cadence","prompt":"The cadence of the speech lulled the crowd.","choices":["rhythm of a sequence","sudden anger","a kind of bird","hidden meaning"],"answer":"rhythm of a sequence"},
      {"kind":"type_word","word":"cadence","prompt":"the rhythmic flow or sequence of sounds","accepted":["cadence"]}
    ]
  }
}
```

Item shapes match `send_test`. Mixed needs ≥2 kinds. Matching needs ≥2 pairs.

## College Counseling writes

Always `getCollegeCounseling` first. After a write, tell Emre to tap **Reload from server**.
Send only real fields. Empty strings are ignored (they will not wipe a box).

Profile (`updateCollegeProfile`) **must** send `patch`:
`{"patch":{"current_grade":"11th grade","preferences":["English-taught bachelor in Europe"],"testing":[{"name":"AP Statistics","status":"Taken","score":"5"}]}}`

Cards (`writeCollegeItem`): ChatGPT cannot send nested objects. Use strings or top-level fields.

- update notes: `{"action":"update","section":"schools","id":"eu_2","notes":"test from GPT"}`
- update via JSON string: `{"action":"update","section":"schools","id":"eu_2","patch":"{\"notes\":\"test from GPT\"}"}`
- add: `{"action":"add","section":"schools","id":"","item":"{\"school_name\":\"Saarland\",\"group\":\"europe_main\",\"program\":\"Computer Science\"}"}`
- delete: `{"action":"delete","section":"schools","id":"eu_saarland"}`
- activity rewrite: `{"action":"update","section":"activities","id":"act_xxx","expanded_description":"full new text"}`
- testing id = exam name; academic_records id = period (e.g. `Grade 10`)

Document merge (`patchCollegeCounseling`) does **not** delete cards:
`{"data":{"overview":{"next_priority":"…"},"counselor_todo":"Check NL diploma eligibility"}}`

`hours_per_week` and `weeks_per_year` must be numbers. School `group` is `us_need_blind` or `europe_main` only.

## Study (`saveStudySession`)

`{"subject":"SAT Math","duration_minutes":45,"session_date":"2026-08-19","notes":"optional"}`

Include `id` to edit a block. Prefer names from the Study page subject list.

## SAT Practice

`getSatPracticeSummary` — completed QBank R&W/Math mocks (separate, estimated) plus official Bluebook SATs (`latest_bluebook`, `official_total`), weak skills, focus_next.

`getSatPracticeAttempts?section=rw` or `section=math` or `section=full`

`getSatPracticeReport` (latest) or `getSatPracticeReport?id=<uuid>`
Returns `report`: the long SAT® Results text (domains, every question, your answer, correct answer, rationale). Official Bluebook imports include TOTAL SCORE. `include_timing_in_report` false means time spent is omitted — do not infer pacing. `misses_only=true` skips the long string.

