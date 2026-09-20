# SAT Module Builder v1.6.1 (Opera)

Builds a timed **Reading and Writing** mock (27 + harder 27) or a timed **Math** mock (22 + harder 22) from your signed-in College Board Student Question Bank, then syncs the HTML, questions, and answers to Emre OS. Can also import official **Bluebook** practice tests (full 1600 SAT) from My Practice.

Install this folder as an unpacked extension (`opera://extensions` → Developer mode → Load unpacked). Do not put the Custom GPT API key here.

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
- Math supports multiple-choice and student-produced response.
- Time per question is recorded in the QBank player; hide it per mock on the app if you used a custom clock. Bluebook imports have timing off.
