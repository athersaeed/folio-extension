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
  ["City", "city"],
  ["Current city", "location"],
  ["Address Line 1", "addressLine1"],
  ["Street address", "addressLine1"],
  ["Address", "addressLine1"],
  ["Address Line 2 (Optional)", "addressLine2"],
  ["Province/State", "region"],
  ["State", "region"],
  ["Which U.S. State or Canadian Province do you reside in?", "region"],
  ["What province do you live in?", "region"],
  ["Postal/Zip Code", "postalCode"],
  ["ZIP", "postalCode"],
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
  [
    "How would you describe your racial/ethnic background? (mark all that apply)",
    "race",
  ],
  ["How would you describe your gender identity?", "gender"],
  [
    "Are you a veteran, active member or reservist of the United States Armed Forces?",
    "veteranStatus",
  ],
  ["Veteran Status", "veteranStatus"],
  ["Disability Status", "disabilityStatus"],
  ["Pronouns", "pronouns"],
  // Must stay unmatched: guessing these would put wrong answers on applications.
  ["Have you previously applied to this company?", null],
  ["Why do you want to work here?", null],
  ["Reference name", null],
  ["Company address", null],
  ["State your reason for applying", null],
  ["Please state the city you live in", null],
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

test("province / state dropdowns accept either spelling", () => {
  const list = ["Select...", "Nova Scotia", "Ontario", "Quebec"];
  assert.equal(matchOption(list, "ON", "region"), 2);
  assert.equal(matchOption(["AB", "ON"], "Ontario", "region"), 1);
  assert.equal(matchOption(list, "ZZ", "region"), -1);
});

test("pronoun answers match by the leading pronoun", () => {
  const list = ["Select...", "He/him/his", "She/her/hers", "They/them/theirs"];
  assert.equal(matchOption(list, "he", "pronouns"), 1);
  assert.equal(matchOption(list, "she/her", "pronouns"), 2);
  assert.equal(matchOption(list, "xe", "pronouns"), -1);
});

test("eligibility questions name a country, or none", async () => {
  const { countryNamed, sameCountry } = await import("../src/options.js");
  assert.equal(
    countryNamed("Are you legally authorized to work in the US?"),
    "united states",
  );
  assert.equal(
    countryNamed("Are you authorized to work in the United States?"),
    "united states",
  );
  assert.equal(
    countryNamed("Will you require sponsorship to work for Affirm in Canada?"),
    "canada",
  );
  assert.equal(
    countryNamed("Are you legally authorized to work for us?"),
    null,
  );
  assert.equal(
    countryNamed(
      "Are you authorized to work in the country in which this job is located?",
    ),
    null,
  );
  assert.equal(
    countryNamed("Authorized in the US or Canada?"),
    null,
    "two countries: unclear",
  );
  assert.equal(sameCountry("united states", "USA"), true);
  assert.equal(sameCountry("canada", "Canada"), true);
  assert.equal(sameCountry("canada", "United States"), false);
});

test("several plain degree options of one level pick the first", () => {
  const list = [
    "Accelerated Master's",
    "Advanced Certificate",
    "Associates",
    "Associate's Degree",
    "Bachelors",
    "Bachelor's Degree",
    "Certificate",
  ];
  assert.equal(matchOption(list, "Bachelor of Science", "degree"), 4);
  assert.equal(
    matchOption(["Accelerated Master's", "Master's Degree"], "MSc", "degree"),
    1,
  );
  assert.equal(matchOption(["Accelerated Master's"], "MSc", "degree"), -1);
});

test("demographic answers across wordings", () => {
  const genders = [
    "Select...",
    "Man",
    "Woman",
    "Non-binary",
    "Transgender man",
    "I don't wish to answer",
  ];
  assert.equal(matchOption(genders, "Male", "gender"), 1);
  assert.equal(matchOption(genders, "Female", "gender"), 2);
  assert.equal(matchOption(genders, "Non-binary", "gender"), 3);
  const races = ["East Asian", "South Asian", "Southeast Asian", "White"];
  assert.equal(
    matchOption(races, "Asian", "race"),
    -1,
    "several Asian options: user picks",
  );
  const yesNo = ["Yes", "No", "I don't wish to answer"];
  assert.equal(matchOption(yesNo, "I am not a veteran", "veteranStatus"), 1);
  assert.equal(
    matchOption(yesNo, "I am not a protected veteran", "veteranStatus"),
    -1,
  );
  const federal = [
    "I am not a protected veteran",
    "I identify as one or more of the classifications of protected veteran",
    "I don't wish to answer",
  ];
  assert.equal(matchOption(federal, "I am not a veteran", "veteranStatus"), 0);
});
