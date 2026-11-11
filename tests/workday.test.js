import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { autofill } from "../src/content/autofill.js";

// Synthetic copy of Workday's dropdown: a button showing "Select One" whose
// options only exist in a popup at the end of <body> once it is clicked.
function workdayPage(selected = "Select One") {
  const { window } = new JSDOM(`<form>
    <div data-automation-id="formField-countryRegion">
      <label for="input-7">Province or Territory</label>
      <button type="button" id="input-7" aria-haspopup="listbox"
        aria-label="Province or Territory ${selected}">${selected}</button>
    </div></form>`);
  const doc = window.document;
  const button = doc.getElementById("input-7");
  button.addEventListener("click", () => {
    if (doc.querySelector('[role="listbox"]')) return;
    const popup = doc.createElement("div");
    popup.innerHTML = `<ul role="listbox">${["Alberta", "Ontario", "Quebec"]
      .map((p) => `<li role="option"><div>${p}</div></li>`)
      .join("")}</ul>`;
    popup.addEventListener("click", (e) => {
      const li = e.target.closest('[role="option"]');
      if (!li) return;
      button.textContent = li.textContent;
      popup.remove();
    });
    doc.body.append(popup);
  });
  return { doc, button };
}

test("picks a province from a Workday listbox button", async () => {
  const { doc, button } = workdayPage();
  const report = await autofill(doc, { fields: { region: "ON" } });
  assert.equal(button.textContent, "Ontario");
  assert.equal(report.find((e) => e.key === "region")?.status, "filled");
  assert.equal(doc.querySelector('[role="listbox"]'), null, "popup closed");
});

test("keeps a province the user already picked", async () => {
  const { doc, button } = workdayPage("Quebec");
  const report = await autofill(doc, { fields: { region: "ON" } });
  assert.equal(button.textContent, "Quebec");
  assert.equal(report.find((e) => e.key === "region")?.status, "kept");
});

// "My Experience": both sections start empty with a bare "Add" button; each
// click renders one entry (Workday-style ids) and the button becomes "Add Another".
function experiencePage() {
  const { window } = new JSDOM(`<form><h2>My Experience</h2>
    <div role="group" id="work"><h3>Work Experience</h3><div class="items"></div>
      <button type="button" data-automation-id="Add">Add</button></div>
    <div role="group" id="edu"><h3>Education</h3><div class="items"></div>
      <button type="button" data-automation-id="Add">Add</button></div></form>`);
  const doc = window.document;
  const date = (id, label, month = true) => `<div>
      <label id="${id}-l">${label}</label>
      ${month ? `<input id="${id}-dateSectionMonth-input" aria-label="Month" role="spinbutton">` : ""}
      <input id="${id}-dateSectionYear-input" aria-label="Year" role="spinbutton"></div>`;
  let n = 10;
  const job = (i) => `<div><h4>Work Experience ${i + 1}</h4>
      <label for="workExperience-${n}--jobTitle">Job Title*</label><input id="workExperience-${n}--jobTitle">
      <label for="workExperience-${n}--companyName">Company*</label><input id="workExperience-${n}--companyName">
      <label><input type="checkbox" id="workExperience-${n}--currentlyWorkHere"> I currently work here</label>
      ${date(`workExperience-${n}--startDate`, "From*")}
      ${date(`workExperience-${n}--endDate`, "To*")}
      <label for="workExperience-${n}--roleDescription">Role Description</label><textarea id="workExperience-${n}--roleDescription"></textarea></div>`;
  const school = () => `<div><h4>Education 1</h4>
      <label for="education-${n}--schoolName">School or University*</label><input id="education-${n}--schoolName">
      ${date(`education-${n}--firstYearAttended`, "From", false)}
      ${date(`education-${n}--lastYearAttended`, "To", false)}</div>`;
  for (const [box, make] of [
    ["work", job],
    ["edu", school],
  ]) {
    const group = doc.getElementById(box);
    const button = group.querySelector("button");
    let count = 0;
    button.addEventListener("click", () =>
      // Workday renders the new entry a moment later.
      setTimeout(() => {
        group
          .querySelector(".items")
          .insertAdjacentHTML("beforeend", make(count++));
        n++;
        button.textContent = "Add Another";
      }, 200),
    );
  }
  return doc;
}

test("adds and fills Workday work and education entries from empty", async () => {
  const doc = experiencePage();
  const report = await autofill(doc, {
    fields: {},
    experience: [
      {
        company: "Acme",
        title: "Analyst",
        startDate: "Sep 2022",
        endDate: "Present",
        description: "Built things.",
      },
      {
        company: "Initech",
        title: "Intern",
        startDate: "2021-05",
        endDate: "2021-08",
      },
    ],
    education: [
      { school: "University of Toronto", startDate: "2018", endDate: "2022" },
    ],
  });
  const vals = (sel) => [...doc.querySelectorAll(sel)].map((e) => e.value);
  assert.deepEqual(vals('[id$="--jobTitle"]'), ["Analyst", "Intern"]);
  assert.deepEqual(vals('[id$="--companyName"]'), ["Acme", "Initech"]);
  assert.deepEqual(vals('[id*="startDate-dateSectionMonth"]'), ["09", "05"]);
  assert.deepEqual(vals('[id*="startDate-dateSectionYear"]'), ["2022", "2021"]);
  assert.deepEqual(vals('[id*="endDate-dateSectionYear"]'), ["", "2021"]);
  assert.deepEqual(
    [...doc.querySelectorAll('[id$="--currentlyWorkHere"]')].map(
      (e) => e.checked,
    ),
    [true, false],
  );
  assert.equal(
    doc.querySelector('[id$="--roleDescription"]').value,
    "Built things.",
  );
  assert.equal(
    doc.querySelector('[id$="--schoolName"]').value,
    "University of Toronto",
  );
  assert.equal(
    doc.querySelector('[id*="firstYearAttended-dateSectionYear"]').value,
    "2018",
  );
  assert.equal(
    doc.querySelector('[id*="lastYearAttended-dateSectionYear"]').value,
    "2022",
  );
  assert.equal(
    doc.querySelectorAll('[id$="--schoolName"]').length,
    1,
    "no extra entries",
  );
  assert.equal(
    report.filter((e) => e.status === "failed").length,
    0,
    JSON.stringify(report.filter((e) => e.status === "failed")),
  );
});

// Education entry with a Degree button (several bachelor options) and a
// Field of Study search prompt: type + Enter shows results, a pick adds a pill.
function educationPage() {
  const { window } =
    new JSDOM(`<form><div data-automation-id="formField-degree">
      <label for="education-4--degree">Degree*</label>
      <button type="button" id="education-4--degree" aria-haspopup="listbox">Select One</button></div>
    <div data-automation-id="formField-fieldOfStudy">
      <label for="education-4--fieldOfStudy">Field of Study</label>
      <div data-automation-id="multiSelectContainer"><div class="pills"></div>
        <input id="education-4--fieldOfStudy" data-uxi-widget-type="selectinput" data-automation-id="searchBox" placeholder="Search">
      </div></div>
    <ul role="listbox" style="display:none"><li role="option">Stale</li></ul></form>`);
  const doc = window.document;
  const popup = (items, onPick) => {
    doc.querySelectorAll(".popup").forEach((p) => p.remove());
    const box = doc.createElement("div");
    box.className = "popup";
    box.innerHTML = `<ul role="listbox">${items.map((t) => `<li role="option">${t}</li>`).join("")}</ul>`;
    box.addEventListener("click", (e) => {
      const li = e.target.closest('[role="option"]');
      if (li) (onPick(li.textContent), box.remove());
    });
    doc.body.append(box);
  };
  const degree = doc.getElementById("education-4--degree");
  degree.addEventListener("click", () =>
    popup(
      [
        "High School",
        "Bachelor of Arts (BA)",
        "Bachelor of Science (BS)",
        "Bachelor of Science in Nursing",
        "Master of Science (MS)",
      ],
      (t) => (degree.textContent = t),
    ),
  );
  const study = doc.getElementById("education-4--fieldOfStudy");
  study.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    setTimeout(
      () =>
        popup(
          [
            "Computer Engineering",
            "Computer Science",
            "Computer Information Systems",
          ],
          (t) => {
            doc.querySelector(".pills").innerHTML =
              `<div data-automation-id="selectedItem">${t}</div>`;
            study.value = "";
          },
        ),
      100,
    );
  });
  return doc;
}

test("picks the matching Workday degree and searches Field of Study", async () => {
  const doc = educationPage();
  const report = await autofill(doc, {
    fields: {},
    education: [
      {
        school: "",
        degree: "Bachelor of Science",
        fieldOfStudy: "Computer Science",
      },
    ],
  });
  assert.equal(
    doc.getElementById("education-4--degree").textContent,
    "Bachelor of Science (BS)",
  );
  assert.equal(
    doc.querySelector('[data-automation-id="selectedItem"]')?.textContent,
    "Computer Science",
  );
  assert.deepEqual(
    report.filter((e) => e.status !== "filled").map((e) => e.key),
    [],
  );
});
