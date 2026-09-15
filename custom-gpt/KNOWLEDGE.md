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

## College Counseling (`updateCollegeCounseling`)

Always `getCollegeCounseling` first. After a write, tell Emre to tap **Reload from server**.

`update_profile` **must** send `patch` (not `data`):
`{"action":"update_profile","patch":{"current_grade":"11th grade"}}`

Testing upsert (does not delete):
`{"action":"update_testing","testing":[{"name":"AP Statistics","status":"Taken","score":5}]}`

Add / edit / delete cards (`section`: activities, research, schools, timeline, essays, recommendations, weekly_checkins, testing, academic_records):
- `{"action":"add_item","section":"schools","item":{"school_name":"MIT","group":"us_need_blind","program":"CS"}}`
- `{"action":"update_item","section":"research","id":"res_lung","patch":{"next_step":"…" }}`
- `{"action":"delete_item","section":"activities","id":"act_council"}`
- testing id = exam name; academic_records id = period
- `add_activity` / `update_activity` still work

Section string fields:
`{"action":"update_section","section":"counselor_todo","data":"Follow up on rec letters"}`

Partial merge onto the **current** document:
`{"action":"patch","data":{"overview":{"next_priority":"…"},"counselor_todo":"…"}}`

`hours_per_week` and `weeks_per_year` must be numbers. School `group` is `us_need_blind` or `europe_main` only.

## Study (`saveStudySession`)

`{"subject":"SAT Math","duration_minutes":45,"session_date":"2026-08-19","notes":"optional"}`

Include `id` to edit a block. Prefer names from the Study page subject list.
