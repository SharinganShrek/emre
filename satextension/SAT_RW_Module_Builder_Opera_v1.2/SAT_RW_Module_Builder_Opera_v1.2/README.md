# SAT R&W 2-Module Builder for Opera

This unpacked Chromium/Opera extension builds a timing-focused SAT Reading & Writing mock from your own authenticated College Board Student Question Bank session.

## What it does
- Creates 27-question Module 1 (mixed Easy / Medium / Hard).
- Creates a 27-question harder Module 2.
- Uses the SAT R&W domain order: Craft and Structure -> Information and Ideas -> Standard English Conventions -> Expression of Ideas.
- Excludes active Bluebook practice-test questions by default.
- Avoids reusing questions generated previously by this extension (you can reset history).
- Downloads:
  - a standalone timed HTML mock (32 minutes per module),
  - Module 1 as `.sat-test`,
  - Module 2 as `.sat-test`.

## Install in Opera
1. Extract this ZIP somewhere permanent.
2. In Opera, open `opera://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted `SAT_RW_Module_Builder_Opera` folder (the folder that contains `manifest.json`).

## Use
1. Sign in to College Board My Practice.
2. Open the **Student Question Bank** results page and choose Reading & Writing; wait until questions load.
3. Open this extension from Opera's Extensions menu.
4. When the status says the College Board session was captured, click **Build & Open Mock**.
5. Open the downloaded `SAT_RW_Timed_Mock_YYYY-MM-DD.html` in Opera and start Module 1.

## Notes
- The second module is always generated as the harder route; this tool does not decide routing from your Module 1 score.
- If you run out of unused questions in a quota, reset extension question history or untick the history option.
- If College Board changes its private web API, the extension may require an update.
- Use only with your own College Board access and in accordance with the terms that apply to your account.

## Blueprint
Module 1 difficulty total: 7 Easy, 12 Medium, 8 Hard.
Hard Module 2 difficulty total: 4 Easy, 9 Medium, 14 Hard.

The builder aims for exact skill+difficulty quotas. If one exact bucket is unavailable, it first falls back to another skill in the same domain+difficulty; only then to the nearest difficulty in the same domain. Any fallback is reported in the popup.

## Technical / attribution note
The College Board endpoint structure and auth-header capture approach were cross-checked against the open-source MIT-licensed `sharthak-sev/sat-qb-exporter` project on GitHub. This extension is a separate minimal implementation tailored to the two-module timing workflow.


## v1.2 auth fix
If College Board returns HTTP 401/403, the extension retries from the open My Practice tab, clears stale saved auth, and asks you to change a Question Bank filter to capture a fresh token.
