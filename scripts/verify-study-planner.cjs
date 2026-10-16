/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Load the pure TypeScript helpers without introducing a test runtime dependency.
const mod = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, "../src/lib/study/ypt.ts"), "utf8");
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, {
  exports: mod.exports,
  Date,
  require: (name) => {
    assert.equal(name, "@/lib/utils");
    return { toISODate: (date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-") };
  },
});
const { encodeYptNotes, sessionBounds, sessionMs, studyBeforePlanner, subtractTimeHoles } = mod.exports;
const date = "2026-10-16";
const at = (hour, minute = 0) => new Date(2026, 9, 16, hour, minute);
function session(start, end, sessionDate = date) {
  return {
    session_date: sessionDate,
    subject: "SAT",
    duration_minutes: Math.round((end - start) / 60_000),
    notes: encodeYptNotes(start, end),
  };
}
function clearEarly(sessions) {
  const hole = studyBeforePlanner(sessions, date);
  return sessions.flatMap((row) => {
    if (row.session_date !== date) return [row];
    const bounds = sessionBounds(row);
    if (!bounds) return [row];
    return subtractTimeHoles(bounds.start, bounds.end, [hole])
      .map(({ start, end }) => session(start, end));
  });
}

// Reproduce the report: the grid is empty but the total still includes 3 hours.
const hidden = [session(at(2), at(5))];
assert.equal(studyBeforePlanner(hidden, date).ms, 3 * 3_600_000);
assert.equal(clearEarly(hidden).reduce((sum, row) => sum + sessionMs(row), 0), 0);

// A block crossing 05:00 must retain its visible portion, including seconds.
const crossing = [session(at(4, 30), new Date(2026, 9, 16, 6, 15, 30))];
assert.equal(studyBeforePlanner(crossing, date).ms, 30 * 60_000);
const remaining = clearEarly(crossing);
assert.equal(remaining.length, 1);
assert.equal(sessionBounds(remaining[0]).start.getTime(), at(5).getTime());
assert.equal(sessionMs(remaining[0]), (75 * 60 + 30) * 1000);
assert.equal(studyBeforePlanner(remaining, date).ms, 0);

// Include 00:00–02:00 even though it can appear on the preceding day's grid.
assert.equal(studyBeforePlanner([session(at(0), at(2))], date).ms, 2 * 3_600_000);
assert.equal(studyBeforePlanner([session(at(5), at(6))], date).ms, 0);
assert.equal(studyBeforePlanner([], date).ms, 0);

// Other calendar days and legacy entries without clock metadata are preserved.
const previous = session(new Date(2026, 9, 15, 23), at(0), "2026-10-15");
const next = session(at(24), at(25), "2026-10-17");
const legacy = { session_date: date, duration_minutes: 60, notes: null };
const mixed = [previous, ...hidden, session(at(9), at(10)), next, legacy];
assert.equal(studyBeforePlanner(mixed, date).ms, 3 * 3_600_000);
const cleared = clearEarly(mixed);
assert.ok(cleared.includes(previous));
assert.ok(cleared.includes(next));
assert.ok(cleared.includes(legacy));
assert.equal(cleared.reduce((sum, row) => sum + sessionMs(row), 0), 4 * 3_600_000);
console.log("Study planner regression checks passed.");
