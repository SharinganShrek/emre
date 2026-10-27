# SAT Module Builder v1.8.1 (Firefox)

Same features as the Opera v1.8.1 folder. The Opera build does not run in Firefox. Firefox does not start a Manifest V3 background service worker; it needs `background.scripts`, and that folder only declares `service_worker`, so the popup has no background to talk to. Its `webRequest` listener also passes Chrome's `extraHeaders` flag, which Firefox rejects. This copy uses a background event page, listens with `requestHeaders` only (Firefox already includes the College Board auth headers), and requires Firefox 142 or newer.

Builds a timed **Reading and Writing** mock (27 + harder 27) or a timed **Math** mock (22 + harder 22) from your signed-in College Board Student Question Bank, then syncs the HTML, questions, and answers to Emre OS. Can also import official **Bluebook** practice tests (full 1600 SAT) from My Practice.

## Install
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` in this folder.

Firefox drops temporary add-ons when it quits, so load this again after a restart. Release Firefox will not permanently install this unsigned folder. Developer Edition or Nightly can, after setting `xpinstall.signatures.required` to `false` in `about:config`. Needs Firefox 142 or newer.

This is a separate extension from the Opera build, so reconnect College Board once and save the Emre OS token again. Do not put the Custom GPT API key here.

## Connect to Emre OS
1. Open Emre OS → **SAT Practice**.
2. Click **Generate connect token** and copy it.
3. In this popup, paste the app URL (`https://emre-xi.vercel.app` or localhost) and the token, then **Save connection**.

Used-question IDs and content hashes live in Emre OS, so updating this extension does not reset history.

## Build a QBank mock
1. Sign in to College Board My Practice and open the Student Question Bank.
2. **Reconnect College Board** if the popup is not ready.
3. Pick **Reading and Writing** or **Math**.
4. **Build & Open Mock** (or download HTML).

After Module 1 and Module 2 you submit, answers (and per-question time) sync to the app.

## Import official Bluebook tests
1. Sign in and open [My Practice dashboard](https://mypractice.collegeboard.org/dashboard).
2. Click **Import Bluebook tests**.
3. Official total / R&W / Math scores and every question (your answer, correct answer, rationale) land on SAT Practice as one 1600 SAT card per attempt.

## Notes
- QBank R&W and Math are separate mocks, not one 1600 SAT.
- Bluebook imports are official College Board scores, not the QBank estimate.
- Module 2 on QBank mocks is always the harder route.
- Reading and Writing follows the Practice 4–6 pattern. Each mock draws skill counts from those module ranges, puts the single cross-text question in one module, and targets module 1 at 5 easy / 18 medium / 4 hard and module 2 at 2 easy / 5 medium / 20 hard. Module 2 Words in Context and Command of Evidence stay hard when the bank has them. Order is Craft and Structure (Words in Context, then Text Structure and Purpose, then cross-text), Information and Ideas ending in Inferences, mixed Standard English Conventions, then transitions and rhetorical synthesis. Difficulty is mixed inside those groups.
- v1.7 still uses the fixed skill-and-difficulty cells. Install this folder separately.
- The QBank player uses the Bluebook section screen. Highlights & Notes is shown only as part of that screen.
- Math supports multiple-choice and student-produced response.
- MathML parentheses (`<mfenced>` / stretchy fences) are rewritten so `f(x)` and `w(w + 29)` keep their brackets. R&W blanks render as `___` without the spoken word “blank”. Reload the extension after updating.
- Time per question is recorded in the QBank player; hide it per mock on the app if you used a custom clock. Bluebook imports have timing off.
