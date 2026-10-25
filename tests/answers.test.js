import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  findSavedAnswer,
  detectCompany,
  normalizeQuestion,
} from "../src/answers.js";
import { captureAnswers } from "../src/content/capture.js";
import { autofill } from "../src/content/autofill.js";
import { summarize } from "../src/summary.js";

const saved = (question, answer, kind = "text", company = "") => ({
  id: question,
  question,
  answer,
  kind,
  company,
  createdAt: "",
  updatedAt: "",
});
const BANK = [
  saved("Are you at least 18 years of age?", "Yes", "choice"),
  saved("Can you work Eastern time zone hours?", "Yes", "choice"),
  saved("Years of professional Python experience", "4"),
  saved("Why do you want to work at Acme?", "Long essay…", "draft", "Acme"),
  saved("Have you applied to Acme before?", "No", "choice", "Acme"),
  saved("Have you applied to Acme before?", "Yes", "choice", "Globex"),
];

test("same wording matches exactly, ignoring case, punctuation and the star", () => {
  const hit = findSavedAnswer(BANK, "ARE YOU AT LEAST 18 YEARS OF AGE?*");
  assert.equal(hit.exact, true);
  assert.equal(hit.answer.answer, "Yes");
  assert.equal(normalizeQuestion("C++ experience?*"), "c++ experience");
});

test("close wording is offered for checking, unrelated wording is not", () => {
  const near = findSavedAnswer(
    BANK,
    "Are you able to work Eastern time zone hours?",
  );
  assert.equal(near.exact, false);
  assert.equal(near.answer.question, "Can you work Eastern time zone hours?");
  assert.equal(findSavedAnswer(BANK, "Are you willing to travel?"), null);
  assert.equal(
    findSavedAnswer(BANK, "Age?"),
    null,
    "too short to compare loosely",
  );
});

test("company answers stay with their company; drafts are never filled", () => {
  assert.equal(
    findSavedAnswer(BANK, "Have you applied to Acme before?", "Acme").answer
      .answer,
    "No",
  );
  assert.equal(
    findSavedAnswer(BANK, "Have you applied to Acme before?", "Initech"),
    null,
  );
  assert.equal(findSavedAnswer(BANK, "Have you applied to Acme before?"), null);
  assert.equal(
    findSavedAnswer(BANK, "Why do you want to work at Acme?", "Acme"),
    null,
  );
});

test("detects the company from Greenhouse titles and URLs", () => {
  const page = (title, url = "https://example.test/") =>
    new JSDOM(`<title>${title}</title>`, { url }).window.document;
  assert.equal(
    detectCompany(
      page("Job Application for Senior Software Engineer at Greenhouse"),
    ),
    "Greenhouse",
  );
  assert.equal(
    detectCompany(
      page("Careers", "https://job-boards.greenhouse.io/acme-corp/jobs/1"),
    ),
    "acme corp",
  );
  assert.equal(detectCompany(page("Careers")), "");
});

const FORM = `<title>Job Application for Engineer at Acme</title><form>
  <label for="fn">First Name</label><input id="fn" value="Ada">
  <label for="age">Are you at least 18 years of age?</label>
  <select id="age"><option value="">Select</option><option value="1" selected>Yes</option><option value="0">No</option></select>
  <label for="py">Years of professional Python experience</label><input id="py" value="4">
  <label for="why">Why do you want to work at Acme?</label><textarea id="why">${"Because ".repeat(20)}</textarea>
  <label for="before">Have you applied to Acme before?</label><input id="before" value="No">
  <label for="ssn">Social Security Number</label><input id="ssn" value="123-45-6789">
  <label for="empty">Anything else?</label><input id="empty">
  <label for="this">Have you previously applied to this company?</label><input id="this" value="No">
  <label><input type="checkbox" checked> I agree</label>
</form>`;

test("capture offers only the user's own answers to non-profile questions", () => {
  const doc = new JSDOM(FORM).window.document;
  const { company, answers } = captureAnswers(doc);
  assert.equal(company, "Acme");
  assert.deepEqual(
    answers.map((a) => [a.question, a.kind, a.company]),
    [
      ["Are you at least 18 years of age?", "choice", ""],
      ["Years of professional Python experience", "text", ""],
      ["Why do you want to work at Acme?", "draft", "Acme"],
      ["Have you applied to Acme before?", "text", "Acme"],
      ["Have you previously applied to this company?", "text", "Acme"],
    ],
  );
  assert.equal(answers[0].answer, "Yes", "the option text, not its value");
});

test("autofill fills saved answers, flags close matches, and respects the switch", async () => {
  const html = `<title>Job Application for Engineer at Acme</title><form>
    <label for="age">Are you at least 18 years of age? *</label>
    <select id="age" required><option value="">Select</option><option value="y">Yes</option><option value="n">No</option></select>
    <label for="py">Years of professional Python experience</label><input id="py">
    <label for="tz">Are you able to work Eastern time zone hours?</label><input id="tz">
    <label for="before">Have you applied to Acme before?</label><input id="before">
  </form>`;
  const doc = new JSDOM(html).window.document;
  const report = await autofill(doc, { fields: {} }, null, { answers: BANK });
  assert.equal(doc.getElementById("age").value, "y");
  assert.equal(doc.getElementById("py").value, "4");
  assert.equal(doc.getElementById("before").value, "No");
  assert.equal(doc.getElementById("tz").value, "Yes");
  assert.equal(
    doc.getElementById("tz").getAttribute("data-folio-autofill"),
    "attention",
  );
  assert.deepEqual(
    report.map((e) => [e.key, e.status]),
    [
      ["saved", "filled"],
      ["saved", "filled"],
      ["saved", "check"],
      ["saved", "filled"],
    ],
  );
  assert.deepEqual(
    summarize([{ report }]).attention.map((e) => e.status),
    ["check"],
  );

  const off = new JSDOM(html).window.document;
  const skipped = await autofill(off, { fields: {} }, null, {
    answers: BANK,
    off: ["savedAnswers"],
  });
  assert.equal(off.getElementById("py").value, "");
  assert.equal(
    skipped.every((e) => e.status === "unmatched"),
    true,
  );
});
