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

## College Counseling writes

Always `getCollegeCounseling` first. After a write, tell Emre to tap **Reload from server**.

Profile (`updateCollegeProfile`) **must** send `patch`:
`{"patch":{"current_grade":"11th grade","preferences":["English-taught bachelor in Europe"]}}`

Testing (`updateCollegeTesting`):
`{"testing":[{"name":"AP Statistics","status":"Taken","score":"5"}]}`

Cards (`section`: activities, research, schools, recommendations, testing, academic_records):
- addCollegeItem: `{"section":"schools","item":{"school_name":"MIT","group":"us_need_blind","program":"CS"}}`
- updateCollegeItem: `{"section":"schools","id":"school_tudelft","patch":{"program":"Computer Science and Engineering","notes":"#1 Europe target"}}`
- deleteCollegeItem: `{"section":"schools","id":"school_aalto"}`
- testing id = exam name; academic_records id = period

Notes (`updateCollegeNotes`):
`{"field":"counselor_todo","text":"Check NL diploma eligibility"}`

Document merge (`patchCollegeCounseling`):
`{"data":{"overview":{"next_priority":"…"},"counselor_todo":"…"}}`

`hours_per_week` and `weeks_per_year` must be numbers. School `group` is `us_need_blind` or `europe_main` only.

## Study (`saveStudySession`)

`{"subject":"SAT Math","duration_minutes":45,"session_date":"2026-08-19","notes":"optional"}`

Include `id` to edit a block. Prefer names from the Study page subject list.
