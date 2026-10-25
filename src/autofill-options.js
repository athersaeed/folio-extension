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
    title: "Links",
    fields: [
      ["linkedin", "LinkedIn"],
      ["github", "GitHub"],
      ["website", "Website / portfolio"],
    ],
  },
  { title: "Documents", fields: [["resume", "Resume upload"]] },
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
      ["startDate", "Start date / notice"],
      ["willingToRelocate", "Willing to relocate"],
      ["howHeard", "How you heard about the job"],
    ],
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
  const { disabledKeys = [] } = await chrome.storage.local.get("disabledKeys");
  return new Set(Array.isArray(disabledKeys) ? disabledKeys : []);
}
export const saveDisabled = (set) =>
  chrome.storage.local.set({ disabledKeys: [...set] });
