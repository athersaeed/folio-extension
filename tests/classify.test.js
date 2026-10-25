import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/classify.js";
import { matchOption } from "../src/options.js";

// [label, expected key] — labels seen on Greenhouse / Lever / Ashby style forms.
const CASES = [
  ["First Name*", "firstName"],
  ["Legal first name", "firstName"],
  ["Preferred First Name", "preferredName"],
  ["Last Name*", "lastName"],
  ["Surname", "lastName"],
  ["Full name", "name"],
  ["Name", "name"],
  ["Email*", "email"],
  ["Email address", "email"],
  ["Phone", "phone"],
  ["Mobile phone number", "phone"],
  ["LinkedIn Profile", "linkedin"],
  ["LinkedIn URL", "linkedin"],
  ["GitHub URL", "github"],
  ["Website", "website"],
  ["Portfolio", "website"],
  ["Country", "country"],
  ["Location (City)", "location"],
  ["Current location", "location"],
  ["Where are you currently based?", "location"],
  [
    "Are you legally authorized to work in the United States?",
    "workAuthorized",
  ],
  [
    "Are you legally authorized to work in the country in which this job is located?",
    "workAuthorized",
  ],
  [
    "Will you now or in the future require sponsorship for employment visa status (e.g. H-1B)?",
    "requiresSponsorship",
  ],
  ["Do you require visa sponsorship?", "requiresSponsorship"],
  ["Are you open to relocation?", "willingToRelocate"],
  ["What are your salary expectations?", "salaryExpectation"],
  ["When can you start?", "startDate"],
  ["How did you hear about this job?", "howHeard"],
  ["How did you initially hear about this job?", "howHeard"],
  ["Gender", "gender"],
  ["Are you Hispanic/Latino?", "hispanicLatino"],
  ["Race", "race"],
  ["Veteran Status", "veteranStatus"],
  ["Disability Status", "disabilityStatus"],
  ["Pronouns", "pronouns"],
  // Must stay unmatched: guessing these would put wrong answers on applications.
  ["Have you previously applied to this company?", null],
  ["Why do you want to work here?", null],
  ["Reference name", null],
  ["Emergency contact phone", null],
  ["Company name", null],
  ["School name", null],
  ["Recruiter email", null],
  ["Preferred office location", null],
  ["Publications (e.g. Google Scholar) URL", null],
  ["Do you meet the requirements in the section above?", null],
  ["Additional Information", null],
];

test("label classification", () => {
  const wrong = CASES.filter(([label, key]) => classify({ label }) !== key).map(
    ([label, key]) => `${label} → ${classify({ label })} (want ${key})`,
  );
  assert.deepEqual(wrong, []);
});

test("id, name and autocomplete hints back up a missing label", () => {
  assert.equal(classify({ id: "first_name" }), "firstName");
  assert.equal(classify({ name: "lastName" }), "lastName");
  assert.equal(classify({ label: "", autocomplete: "email" }), "email");
  assert.equal(classify({ id: "question_18599704008" }), null);
});

test("file inputs: resume yes, cover letter no", () => {
  assert.equal(classify({ kind: "file", label: "Resume/CV*" }), "resume");
  assert.equal(classify({ kind: "file", label: "Cover Letter" }), null);
  assert.equal(
    classify({ kind: "file", label: "Attach", id: "resume" }),
    "resume",
  );
});

test("option matching", () => {
  const yn = ["Select...", "Yes", "No"];
  assert.equal(matchOption(yn, "Yes"), 1);
  assert.equal(matchOption(yn, "No"), 2);
  assert.equal(
    matchOption(
      ["Yes, I have a disability", "No, I don't", "I do not want to answer"],
      "Yes, I have a disability (or previously had a disability)",
    ),
    0,
  );
  // Two different "Yes" options means a human must choose.
  assert.equal(
    matchOption(["Yes - citizen", "Yes - visa holder", "No"], "Yes"),
    -1,
  );
  assert.equal(
    matchOption(
      ["Male", "Female", "Decline To Self Identify"],
      "Decline to self-identify",
    ),
    2,
  );
  assert.equal(
    matchOption(
      ["Male", "Female", "I don't wish to answer"],
      "Decline to self-identify",
    ),
    2,
  );
  assert.equal(matchOption(["Male", "Female"], "Female"), 1);
  assert.equal(
    matchOption(["Canada", "United States", "Mexico"], "USA", "country"),
    1,
  );
  assert.equal(
    matchOption(
      ["Asian (Not Hispanic or Latino)", "White (Not Hispanic or Latino)"],
      "Asian",
    ),
    0,
  );
  assert.equal(matchOption(["LinkedIn", "Referral"], ""), -1);
  const toronto = [
    "Toronto, Ontario, Canada",
    "Toronto, Ohio, United States",
    "North Toronto, Ontario, Canada",
  ];
  assert.equal(matchOption(toronto, "Toronto, ON", "location"), 0);
  assert.equal(matchOption(toronto, "Toronto, OH", "location"), 1);
  assert.equal(
    matchOption(toronto, "Toronto", "location"),
    -1,
    "ambiguous city",
  );
  assert.equal(
    matchOption(["Waterloo, Ontario, Canada"], "Toronto, ON", "location"),
    -1,
  );
  assert.equal(matchOption(["Option A", "Option B"], "Something else"), -1);
});
