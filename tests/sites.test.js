import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { autofill } from "../src/content/autofill.js";
import { collectFields } from "../src/content/fields.js";
import { classify } from "../src/classify.js";
import { matchOption } from "../src/options.js";
import { detectCompany } from "../src/answers.js";

// Trimmed copies of the markup Lever and Ashby render (2026-10), synthetic text.
// Full interactive stand-ins live in fixtures/lever.html and fixtures/ashby.jsx.
const LEVER = `<form>
  <li class="application-question"><label>
    <div class="application-label">Full name<span class="required">✱</span></div>
    <div class="application-field"><input type="text" name="name" required></div>
  </label></li>
  <li class="application-question"><label>
    <div class="application-label">Current location <span class="required">✱</span></div>
    <div class="application-field">
      <input class="location-input" type="text" name="location" required>
      <div class="dropdown-container"><div class="dropdown-results"></div>
        <div class="dropdown-no-results">No location found. Try entering a different location</div></div>
    </div>
  </label></li>
  <li class="application-question custom-question"><div>
    <div class="application-label multiple-choice"><div class="text">Are you legally authorized to work in the country for which you are applying?<span class="required">✱</span></div></div>
    <div class="application-field"><ul data-qa="multiple-choice">
      <li><label><input type="radio" name="cards[a][field0]" value="Yes"><span>Yes</span></label></li>
      <li><label><input type="radio" name="cards[a][field0]" value="No"><span>No</span></label></li>
    </ul></div>
  </div></li>
  <li class="application-question custom-question"><div>
    <div class="application-label multiple-select"><div class="text">Pronouns (check all that apply)</div></div>
    <div class="application-field"><ul data-qa="checkboxes">
      <li><label><input type="checkbox" name="cards[a][field1]" value="He/him"><span>He/him</span></label></li>
      <li><label><input type="checkbox" name="cards[a][field1]" value="She/her"><span>She/her</span></label></li>
    </ul></div>
  </div></li>
  <div class="application-question"><label>
    <div class="application-label">Race</div>
    <div class="application-field"><select name="eeo[race]"><option value="">Select ...</option>
      <option>Hispanic or Latino</option><option>White (Not Hispanic or Latino)</option>
      <option>Asian (Not Hispanic or Latino)</option><option>Decline to self-identify</option></select></div>
  </label></div>
</form>
<script>
  // Lever's location box: suggestions after a keydown, picked on mousedown.
  const input = document.querySelector(".location-input");
  input.addEventListener("keydown", () => setTimeout(() => {
    document.querySelector(".dropdown-results").innerHTML =
      '<div class="dropdown-location" id="location-0">Toronto, Ontario, Canada</div>';
  }, 50));
  document.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("dropdown-location")) input.value = e.target.textContent;
  });
</script>`;

const ASHBY = `<div class="ashby-application-form-container">
  <div class="ashby-application-form-field-entry">
    <label class="ashby-application-form-question-title" for="tel-1">Phone</label>
    <input id="tel-1" name="tel-1" type="tel">
    <ul><li><label><input type="radio" name="smsConsent" value="given"> Yes - I consent to receiving SMS text messages</label>
      <label><input type="radio" name="smsConsent" value="notGiven"> No - I do not consent</label></li></ul>
  </div>
  <div class="ashby-application-form-field-entry">
    <label class="ashby-application-form-question-title" for="q-sponsor">Will you now or in the future require sponsorship?</label>
    <div class="ashby-application-form-input-yesno">
      <button aria-pressed="false">Yes</button><button aria-pressed="false">No</button>
      <input type="checkbox" tabindex="-1" name="q-sponsor" style="display:none">
    </div>
  </div>
  <div><fieldset class="ashby-application-form-input-radio-group">
    <label class="ashby-application-form-question-title" for="_systemfield_eeoc_gender">Gender</label>
    <div><input type="radio" id="g0" name="g"><label for="g0">Male</label></div>
    <div><input type="radio" id="g1" name="g"><label for="g1">Female</label></div>
  </fieldset></div>
  <div><fieldset class="ashby-application-form-input-checkbox-group">
    <label class="ashby-application-form-question-title" for="q-tools">Which of these do you use? (select all that apply)</label>
    <div><input type="checkbox" id="t0" name="Email"><label for="t0">Email</label></div>
    <div><input type="checkbox" id="t1" name="Slack"><label for="t1">Slack</label></div>
  </fieldset></div>
</div>
<script>
  // Ashby's Yes/No: a click presses one button and releases the other.
  for (const b of document.querySelectorAll(".ashby-application-form-input-yesno button"))
    b.addEventListener("click", () => {
      for (const o of b.parentElement.querySelectorAll("button"))
        o.setAttribute("aria-pressed", String(o === b));
    });
</script>`;

const dom = (html) =>
  new JSDOM(html, { runScripts: "dangerously" }).window.document;

test("Lever: titles beside or around the control, without the ✱", () => {
  const fields = collectFields(dom(LEVER));
  assert.deepEqual(
    fields.map((f) => [f.kind, f.label, classify(f)]),
    [
      ["text", "Full name", "name"],
      ["suggest", "Current location", "location"],
      [
        "radio",
        "Are you legally authorized to work in the country for which you are applying?",
        "workAuthorized",
      ],
      ["checkboxes", "Pronouns (check all that apply)", "pronouns"],
      ["select", "Race", "race"],
    ],
  );
  assert.deepEqual(
    fields[2].options.map((o) => o.label),
    ["Yes", "No"],
    "options keep their own labels",
  );
});

test("Lever: fills radios, checkbox lists, EEO selects and picks a location", async () => {
  const doc = dom(LEVER);
  const report = await autofill(doc, {
    fields: {
      name: "Ada Synthetic",
      location: "Toronto, ON",
      workAuthorized: "Yes",
      pronouns: "he/him",
      race: "South Asian",
    },
  });
  assert.ok(
    report.every((e) => e.status === "filled"),
    JSON.stringify(report),
  );
  assert.equal(
    doc.querySelector("[name=location]").value,
    "Toronto, Ontario, Canada",
  );
  assert.equal(doc.querySelector("[value=Yes]").checked, true);
  assert.equal(doc.querySelector("[value='He/him']").checked, true);
  assert.equal(doc.querySelector("[value='She/her']").checked, false);
  assert.equal(
    doc.querySelector("[name='eeo[race]']").value,
    "Asian (Not Hispanic or Latino)",
  );
});

test("Ashby: Yes/No buttons, fieldset titles, consent radios left alone", async () => {
  const doc = dom(ASHBY);
  const fields = collectFields(doc);
  assert.deepEqual(
    fields.map((f) => [f.kind, f.label.slice(0, 40), classify(f)]),
    [
      ["text", "Phone", "phone"],
      ["radio", "Yes - I consent to receiving SMS text me", null],
      [
        "buttons",
        "Will you now or in the future require sp",
        "requiresSponsorship",
      ],
      ["radio", "Gender", "gender"],
      ["checkboxes", "Which of these do you use? (select all t", null],
    ],
  );
  const applicant = {
    fields: { phone: "555-0100", requiresSponsorship: "No", gender: "Female" },
  };
  await autofill(doc, applicant);
  const [yes, no] = doc.querySelectorAll("button");
  assert.equal(no.getAttribute("aria-pressed"), "true");
  assert.equal(doc.getElementById("g1").checked, true);
  assert.ok(
    ![...doc.querySelectorAll("[name=smsConsent]")].some((r) => r.checked),
  );
  // A second click on a pressed button would clear it; filled answers are kept.
  const again = await autofill(doc, applicant);
  assert.equal(no.getAttribute("aria-pressed"), "true");
  assert.equal(yes.getAttribute("aria-pressed"), "false");
  assert.equal(again.find((e) => e.kind === "buttons").status, "kept");
});

test("race options qualified with 'Not Hispanic or Latino'", () => {
  const options = [
    "Hispanic or Latino",
    "White (Not Hispanic or Latino)",
    "Black or African American (Not Hispanic or Latino)",
    "Asian (Not Hispanic or Latino)",
  ];
  assert.equal(matchOption(options, "White", "race"), 1);
  assert.equal(matchOption(options, "Black", "race"), 2);
  assert.equal(matchOption(options, "Hispanic or Latino", "race"), 0);
});

test("company names from Lever and Ashby page titles", () => {
  const page = (title, url) =>
    new JSDOM(`<title>${title}</title>`, { url }).window.document;
  assert.equal(
    detectCompany(
      page(
        "Acme Robotics - Software Engineer",
        "https://jobs.lever.co/acme/1/apply",
      ),
    ),
    "Acme Robotics",
  );
  assert.equal(
    detectCompany(
      page(
        "Software Engineer @ Acme",
        "https://jobs.ashbyhq.com/acme/1/application",
      ),
    ),
    "Acme",
  );
});
