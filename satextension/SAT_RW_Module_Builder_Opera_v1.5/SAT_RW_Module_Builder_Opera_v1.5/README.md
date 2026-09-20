# SAT R&W Module Builder v1.5 (Opera)

If the popup is not ready, click **Reconnect College Board**. The extension hard-reloads the signed-in Student Question Bank and captures the Catapult session using both Chromium webRequest and an in-page fetch/XHR fallback.

Then click **Build & Open Mock** to create the 27-question Module 1 and harder 27-question Module 2.


## Standalone HTML export
- **Build & Download HTML** creates a new 27+27 mock and downloads it as a standalone `.html` file.
- **Download Current Mock HTML** saves the exact last mock that was generated/opened, without selecting new questions.
- Question text, answer choices, correct answers, rationale, timer, navigation, and results logic are embedded in the file. If a question contains an externally hosted image, that image may still require internet access when the file is opened later.

## v1.5
- The timed mock HTML uses a Bluebook-style Reading & Writing layout: header with section title and directions, two-pane passage/question view, circular A–D choices, Mark for Review, option eliminator, bottom question menu, review-before-submit, and a 5-minute warning.
- A **Pause** control stops the timer. While paused, passage, prompt, and answer choices are hidden until you resume.
- Question selection, module blueprints, session capture, and scoring are unchanged from v1.4.
