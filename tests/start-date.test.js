import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  startPlan,
  dateForTextField,
  optionWeeks,
  matchNotice,
} from "../src/start-date.js";
import { autofill } from "../src/content/autofill.js";

const SUN_OCT_25 = new Date(2026, 9, 25, 15, 30);
const plan = (fields, now = SUN_OCT_25) => startPlan(fields, now);

test("notice weeks land on the next Monday", () => {
  assert.equal(plan({ noticePeriod: "2 weeks" }).iso, "2026-11-09");
  assert.equal(
    plan({ noticePeriod: "2 weeks" }).text,
    "2 weeks' notice (available Mon, Nov 9, 2026)",
  );
  assert.equal(
    plan({ noticePeriod: "1 week" }, new Date(2026, 9, 28)).iso,
    "2026-11-09",
  );
  assert.equal(
    plan({ noticePeriod: "1 week" }, new Date(2026, 9, 26)).iso,
    "2026-11-02",
    "Monday stays Monday",
  );
  assert.equal(
    plan({ noticePeriod: "1 week" }).text,
    "1 week's notice (available Mon, Nov 2, 2026)",
  );
});

test("immediately, specific dates, and missing answers", () => {
  assert.deepEqual(
    [
      plan({ noticePeriod: "Immediately" }).iso,
      plan({ noticePeriod: "Immediately" }).text,
    ],
    ["2026-10-25", "Immediately"],
  );
  const later = plan({
    noticePeriod: "Specific date",
    availableFrom: "2026-12-01",
  });
  assert.equal(later.iso, "2026-12-01");
  assert.equal(later.text, "Available from Tue, Dec 1, 2026");
  assert.equal(later.weeks, 6);
  const past = plan({
    noticePeriod: "Specific date",
    availableFrom: "2026-01-05",
  });
  assert.equal(past.text, "Immediately", "a passed date means available now");
  assert.equal(plan({ noticePeriod: "Specific date" }), null);
  assert.equal(plan({}), null);
});

test("text boxes that name a format get a bare date", () => {
  const p = plan({ noticePeriod: "2 weeks" });
  assert.equal(dateForTextField(p, "MM/DD/YYYY"), "11/09/2026");
  assert.equal(dateForTextField(p, "Start date (dd/mm/yyyy)"), "09/11/2026");
  assert.equal(dateForTextField(p, "yyyy-mm-dd"), "2026-11-09");
  assert.equal(dateForTextField(p, "When can you start?"), null);
});

test("reading notice options", () => {
  assert.deepEqual(optionWeeks("Immediately"), [0, 0]);
  assert.deepEqual(optionWeeks("2 weeks"), [2, 2]);
  assert.deepEqual(optionWeeks("Two weeks' notice"), [2, 2]);
  assert.deepEqual(optionWeeks("1 month"), [4, 4]);
  assert.deepEqual(optionWeeks("2-4 weeks"), [2, 4]);
  assert.deepEqual(optionWeeks("Within a month"), [0, 4]);
  assert.deepEqual(optionWeeks("4+ weeks"), [4, Infinity]);
  assert.equal(optionWeeks("Select..."), null);
  assert.equal(optionWeeks("Other"), null);
});

test("choosing the notice option", () => {
  const simple = [
    "Select...",
    "Immediately",
    "2 weeks",
    "1 month",
    "More than 1 month",
  ];
  const pick = (options, notice) =>
    matchNotice(options, plan({ noticePeriod: notice }));
  assert.equal(pick(simple, "Immediately"), 1);
  assert.equal(pick(simple, "2 weeks"), 2);
  assert.equal(pick(simple, "4 weeks"), 3);
  assert.equal(pick(simple, "3 weeks"), -1, "no option means 3 weeks");
  const ranges = ["Less than 2 weeks", "2-4 weeks", "More than 4 weeks"];
  assert.equal(pick(ranges, "2 weeks"), 1, "less than 2 excludes 2");
  assert.equal(pick(ranges, "1 week"), 0);
  assert.equal(
    pick(["ASAP", "Within two weeks", "Within a month"], "2 weeks"),
    1,
  );
  assert.equal(
    pick(["Within 2 weeks", "2-4 weeks"], "2 weeks"),
    -1,
    "equally specific: ask",
  );
});

test("autofill puts the right shape into each kind of start-date field", async () => {
  const { window } = new JSDOM(`<form>
    <label for="a">Earliest start date</label><input id="a" type="date">
    <label for="b">Start date</label><input id="b" placeholder="MM/DD/YYYY">
    <label for="c">When can you start?</label><textarea id="c"></textarea>
    <label for="d">Notice period</label>
    <select id="d"><option></option><option>Immediately</option><option>2 weeks</option><option>1 month</option></select>
  </form>`);
  const doc = window.document;
  const fields = { noticePeriod: "2 weeks" };
  const expected = startPlan(fields);
  const report = await autofill(doc, { fields });
  assert.equal(doc.getElementById("a").value, expected.iso);
  assert.match(doc.getElementById("b").value, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.equal(doc.getElementById("c").value, expected.text);
  assert.equal(
    doc.getElementById("d").selectedOptions[0].textContent,
    "2 weeks",
  );
  assert.deepEqual(
    report.map((e) => e.status),
    ["filled", "filled", "filled", "filled"],
  );

  const { window: w2 } = new JSDOM(
    `<label for="a">Start date</label><input id="a" required>`,
  );
  const empty = await autofill(w2.document, {
    fields: { startDate: "monday after 2 sundays" },
  });
  assert.equal(empty[0].status, "no-value", "old free text is never typed in");
  assert.equal(w2.document.getElementById("a").value, "");
});
