import { ext } from "./ext.js";
// Which kinds of field the extension may fill. Everything is on by default;
// the user switches fields off in the popup's Options tab. Keys match the
// classifier's output and Folio's profile schema.
export const OPTION_GROUPS = [
  {
    title: "Contact",
    fields: [
      ["firstName", "First name"],
      ["lastName", "Last name"],
      ["preferredName", "Preferred name"],
      ["name", "Full name"],
      ["pronouns", "Pronouns"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["location", "Location (city)"],
      ["country", "Country"],
    ],
  },
  {
    title: "Mailing address",
    fields: [
      ["addressLine1", "Address line 1"],
      ["addressLine2", "Address line 2"],
      ["city", "City"],
      ["region", "Province / state"],
      ["postalCode", "Postal / ZIP code"],
    ],
  },
  {
    title: "Links",
    fields: [
      ["linkedin", "LinkedIn"],
      ["github", "GitHub"],
      ["website", "Website / portfolio"],
    ],
  },
  { title: "Documents", fields: [["resume", "Resume upload"]] },
  {
    title: "From your resume",
    fields: [
      ["education", "Education (school, degree, dates)"],
      ["experience", "Work experience (company, title, dates)"],
    ],
  },
  {
    title: "Work eligibility",
    fields: [
      ["workAuthorized", "Authorized to work"],
      ["requiresSponsorship", "Needs sponsorship"],
    ],
  },
  {
    title: "Preferences",
    fields: [
      ["salaryExpectation", "Salary expectation"],
      ["startDate", "Start date (from notice period)"],
      ["willingToRelocate", "Willing to relocate"],
      ["howHeard", "How you heard about the job"],
    ],
  },
  {
    title: "Learned from past forms",
    fields: [["savedAnswers", "Saved answers (from Folio)"]],
  },
  {
    title: "Voluntary self-identification",
    fields: [
      ["gender", "Gender"],
      ["hispanicLatino", "Hispanic or Latino"],
      ["race", "Race"],
      ["veteranStatus", "Veteran status"],
      ["disabilityStatus", "Disability status"],
    ],
  },
];

export async function loadDisabled() {
  const { disabledKeys = [] } = await ext.storage.local.get("disabledKeys");
  return new Set(Array.isArray(disabledKeys) ? disabledKeys : []);
}
export const saveDisabled = (set) =>
  ext.storage.local.set({ disabledKeys: [...set] });
