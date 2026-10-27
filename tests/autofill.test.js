import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { autofill } from "../src/content/autofill.js";
import { summarize } from "../src/summary.js";

// Plain HTML form (older Greenhouse / Lever style). React-select dropdowns are
// covered by the browser fixture in fixtures/greenhouse.html.
const HTML = `<form>
  <label for="first_name">First Name *</label><input id="first_name" required>
  <label for="last_name">Last Name *</label><input id="last_name" required value="Typed">
  <label>Email <input type="email" name="email"></label>
  <input type="hidden" name="token" value="x">
  <label for="auth">Are you legally authorized to work in the US?</label>
  <select id="auth"><option value="">--</option><option value="1">Yes</option><option value="0">No</option></select>
  <fieldset><legend>Will you require sponsorship?</legend>
    <label><input type="radio" name="spons" value="y"> Yes</label>
    <label><input type="radio" name="spons" value="n"> No</label>
  </fieldset>
  <label for="why">Why us? *</label><textarea id="why" required></textarea>
  <label for="gender">Gender</label><select id="gender"><option></option><option>Male</option><option>Female</option></select>
  <label><input type="checkbox" required> I agree</label>
</form>`;

test("fills empty fields, keeps typed ones, flags required unknowns", async () => {
  const { window } = new JSDOM(HTML);
  const doc = window.document;
  const inputEvents = [];
  doc
    .getElementById("first_name")
    .addEventListener("input", () => inputEvents.push("first"));
  const report = await autofill(doc, {
    fields: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.test",
      workAuthorized: "Yes",
      requiresSponsorship: "No",
    },
  });
  assert.equal(doc.getElementById("first_name").value, "Ada");
  assert.deepEqual(inputEvents, ["first"], "frameworks hear an input event");
  assert.equal(
    doc.getElementById("last_name").value,
    "Typed",
    "never overwrites",
  );
  assert.equal(doc.querySelector("[name=email]").value, "ada@example.test");
  assert.equal(doc.getElementById("auth").value, "1");
  assert.equal(doc.querySelector("[name=spons][value=n]").checked, true);
  assert.equal(
    doc.getElementById("gender").value,
    "",
    "no saved answer, no guess",
  );
  assert.equal(doc.querySelector("[type=checkbox]").checked, false);
  assert.equal(
    doc.getElementById("why").getAttribute("data-folio-autofill"),
    "attention",
  );
  assert.equal(
    report.some((e) => e.label.includes("token")),
    false,
  );

  const { filled, attention, skipped } = summarize([{ report }]);
  assert.deepEqual(
    filled.map((e) => e.key),
    ["firstName", "email", "workAuthorized", "requiresSponsorship"],
  );
  assert.deepEqual(
    attention.map((e) => e.label),
    ["Why us? *", "I agree"],
  );
  assert.deepEqual(skipped.map((e) => e.status).sort(), ["kept", "no-value"]);
});

test("fields switched off are left alone and never flagged", async () => {
  const { window } = new JSDOM(HTML);
  const doc = window.document;
  const report = await autofill(
    doc,
    { fields: { firstName: "Ada", email: "ada@example.test" } },
    null,
    { off: ["firstName"] },
  );
  assert.equal(doc.getElementById("first_name").value, "");
  assert.equal(
    doc.getElementById("first_name").hasAttribute("data-folio-autofill"),
    false,
  );
  assert.equal(doc.querySelector("[name=email]").value, "ada@example.test");
  const first = report.find((e) => e.key === "firstName");
  assert.equal(first.status, "off");
  assert.equal(summarize([{ report }]).attention.includes(first), false);
});

test("fills questions that appear after an earlier answer", async () => {
  const { window } = new JSDOM(`<form>
    <label for="hl">Are you Hispanic/Latino?</label>
    <select id="hl"><option value=""></option><option>Yes</option><option>No</option></select>
  </form>`);
  const doc = window.document;
  doc.getElementById("hl").addEventListener("change", () => {
    doc.querySelector("form").insertAdjacentHTML(
      "beforeend",
      `<label for="race">Please identify your race</label>
       <select id="race"><option value=""></option><option>Asian</option><option>White</option></select>`,
    );
  });
  const report = await autofill(doc, {
    fields: { hispanicLatino: "No", race: "Asian" },
  });
  assert.equal(doc.getElementById("race").value, "Asian");
  assert.equal(report.filter((e) => e.key === "race").length, 1);
});
