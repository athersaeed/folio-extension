import { test } from "node:test";
import assert from "node:assert/strict";
import { profileSections } from "../src/profile.js";

test("profile tab lists saved answers, resume entries and past-form answers", () => {
  const sections = profileSections(
    {
      fields: {
        firstName: "Testy",
        email: "t@example.test",
        noticePeriod: "2 weeks",
        phone: "",
      },
      experience: [
        {
          company: "Example Corp",
          title: "Developer",
          startDate: "2023",
          endDate: "Present",
        },
      ],
      education: [],
      skills: "SQL",
    },
    [
      { question: "Are you 18 or older?", answer: "Yes", kind: "choice" },
      { question: "Why us?", answer: "Because.", kind: "draft" },
    ],
  );
  const flat = Object.fromEntries(
    sections.map((s) => [s.title, s.rows.map((r) => [r.label, r.value])]),
  );
  assert.deepEqual(flat.Contact, [
    ["First name", "Testy"],
    ["Email", "t@example.test"],
  ]);
  assert.deepEqual(flat["More answers"], [["Notice period", "2 weeks"]]);
  assert.deepEqual(flat["Work experience"], [
    ["Company", "Example Corp"],
    ["Job title", "Developer"],
    ["Dates", "2023 – Present"],
  ]);
  // Every row carries its job's heading, so search results stay labelled.
  assert.deepEqual(
    sections
      .find((s) => s.title === "Work experience")
      .rows.map((r) => r.entry),
    Array(3).fill("Example Corp · Developer"),
  );
  assert.equal(flat.Education, undefined);
  assert.deepEqual(flat.Skills, [["Skills", "SQL"]]);
  assert.deepEqual(flat["Saved from past forms"], [
    ["Are you 18 or older?", "Yes"],
    ["Why us? (draft)", "Because."],
  ]);
});

test("profile tab is empty without data", () => {
  assert.deepEqual(profileSections(undefined, undefined), []);
});
