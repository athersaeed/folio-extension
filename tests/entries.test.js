import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { parseDate, assignEntries, entryValue } from "../src/entries.js";
import { matchOption } from "../src/options.js";
import { autofill } from "../src/content/autofill.js";

test("resume dates parse to month and year", () => {
  assert.deepEqual(parseDate("September 2022"), { year: "2022", month: 9 });
  assert.deepEqual(parseDate("Sep. 2022"), { year: "2022", month: 9 });
  assert.deepEqual(parseDate("09/2022"), { year: "2022", month: 9 });
  assert.deepEqual(parseDate("2021"), { year: "2021", month: null });
  assert.deepEqual(parseDate("Present"), { present: true });
  assert.equal(parseDate("soon"), null);
});

test("degree, month and school options", () => {
  const degrees = [
    "Select...",
    "High School",
    "Associate's Degree",
    "Bachelor's Degree",
    "Master's Degree",
    "Master of Business Administration (M.B.A.)",
    "Doctor of Philosophy (Ph.D.)",
    "Other",
  ];
  assert.equal(matchOption(degrees, "Bachelor of Science", "degree"), 3);
  assert.equal(matchOption(degrees, "BSc", "degree"), 3);
  assert.equal(matchOption(degrees, "MBA", "degree"), 5);
  assert.equal(matchOption(degrees, "Certificate", "degree"), -1);
  const months = [
    "Select...",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  assert.equal(matchOption(months, "September", "startMonth"), 9);
  assert.equal(matchOption(["01", "02", "09"], "September", "endMonth"), 2);
  const schools = [
    "Synthetic State University - East Campus",
    "University of Waterloo",
  ];
  assert.equal(
    matchOption(schools, "Synthetic State University", "school"),
    -1,
    "near miss is another school",
  );
  assert.equal(matchOption(schools, "University of Waterloo", "school"), 1);
});

test("fields group into entries by section and repetition", () => {
  const f = (label) => ({ label, id: "", name: "" });
  const fields = [
    "School",
    "Degree",
    "Start date year",
    "School",
    "Degree",
    "Company name",
    "Title",
    "Start date month",
    "Why us?",
  ].map(f);
  const { entries, count } = assignEntries(fields);
  const at = (i) => entries.get(fields[i]);
  assert.deepEqual(at(2), { section: "education", index: 0, key: "startYear" });
  assert.deepEqual(at(4), { section: "education", index: 1, key: "degree" });
  assert.deepEqual(at(7), {
    section: "experience",
    index: 0,
    key: "startMonth",
  });
  assert.equal(entries.has(fields[8]), false);
  assert.deepEqual(count, { education: 2, experience: 1 });
  assert.equal(
    entryValue(
      { experience: [{ endDate: "Present" }] },
      { section: "experience", index: 0, key: "current" },
    ),
    true,
  );
});

const MONTH_OPTS = `<option value=""></option>${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m) => `<option>${m}</option>`).join("")}`;
function jobHtml(i) {
  return `<div class="job">
    <label for="company-${i}">Company name</label><input id="company-${i}">
    <label for="title-${i}">Title</label><input id="title-${i}">
    <label for="sm-${i}">Start date month</label><select id="sm-${i}">${MONTH_OPTS}</select>
    <label for="sy-${i}">Start date year</label><input id="sy-${i}">
    <label for="em-${i}">End date month</label><select id="em-${i}">${MONTH_OPTS}</select>
    <label for="ey-${i}">End date year</label><input id="ey-${i}">
    <label><input type="checkbox" id="cur-${i}"> Current role</label>
  </div>`;
}

test("fills every resume entry, adding sections as needed", async () => {
  const { window } = new JSDOM(`<form>
    <h3>Education</h3>
    <label for="school">School</label><input id="school">
    <label for="degree">Degree</label><select id="degree"><option></option><option>Bachelor's Degree</option><option>Master's Degree</option></select>
    <label for="disc">Discipline</label><input id="disc">
    <h3>Employment</h3><div id="jobs">${jobHtml(0)}</div>
    <button type="button" id="add">+ Add another</button>
    <label for="country">Please select the country where you currently reside.</label><input id="country">
  </form>`);
  const doc = window.document;
  let n = 1;
  doc
    .getElementById("add")
    .addEventListener("click", () =>
      doc.getElementById("jobs").insertAdjacentHTML("beforeend", jobHtml(n++)),
    );
  await autofill(doc, {
    fields: { country: "Canada" },
    education: [
      {
        school: "Synthetic University",
        degree: "Bachelor of Science",
        fieldOfStudy: "Computer Science",
        startDate: "September 2022",
        endDate: "August 2026",
      },
    ],
    experience: [
      {
        company: "Acme",
        title: "Developer",
        startDate: "May 2025",
        endDate: "Present",
      },
      {
        company: "Globex",
        title: "Intern",
        startDate: "Jan 2024",
        endDate: "Apr 2024",
      },
      {
        company: "Initech",
        title: "Tutor",
        startDate: "2023",
        endDate: "2023",
      },
    ],
  });
  const v = (id) => doc.getElementById(id).value;
  assert.equal(v("school"), "Synthetic University");
  assert.equal(v("degree"), "Bachelor's Degree");
  assert.equal(v("disc"), "Computer Science");
  assert.equal(v("country"), "Canada");
  assert.equal(
    doc.querySelectorAll(".job").length,
    3,
    "added exactly two jobs",
  );
  assert.deepEqual(
    [v("company-0"), v("company-1"), v("company-2")],
    ["Acme", "Globex", "Initech"],
  );
  assert.equal(v("sm-0"), "May");
  assert.equal(v("sy-0"), "2025");
  assert.equal(doc.getElementById("cur-0").checked, true);
  assert.equal(v("ey-0"), "", "no end date for a current role");
  assert.equal(doc.getElementById("cur-1").checked, false);
  assert.deepEqual(
    [v("sm-1"), v("em-1"), v("ey-1")],
    ["January", "April", "2024"],
  );
  assert.equal(v("sm-2"), "", "year-only dates leave the month alone");
});

test("stops adding entries after a failed one, and respects the switch", async () => {
  const html = `<form><div id="jobs">${jobHtml(0).replace('<input id="title-0">', '<select id="title-0"><option></option><option>Other</option></select>')}</div><button type="button" id="add">Add another</button></form>`;
  const run = async (off) => {
    const { window } = new JSDOM(html);
    const doc = window.document;
    doc
      .getElementById("add")
      .addEventListener("click", () =>
        doc.getElementById("jobs").insertAdjacentHTML("beforeend", jobHtml(1)),
      );
    await autofill(
      doc,
      {
        fields: {},
        experience: [
          { company: "Acme", title: "Developer" },
          { company: "Globex" },
        ],
      },
      null,
      { off },
    );
    return doc;
  };
  assert.equal((await run([])).querySelectorAll(".job").length, 1);
  const offDoc = await run(["experience"]);
  assert.equal(offDoc.getElementById("company-0").value, "");
  assert.equal(offDoc.querySelectorAll(".job").length, 1);
});
