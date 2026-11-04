// Everything Folio sent, laid out for the popup's Profile tab so the user can
// copy what autofill left blank. Grouped like the Options tab, then resume
// entries and saved answers. Empty values are left out.
import { OPTION_GROUPS } from "./autofill-options.js";

const NOT_PROFILE = new Set([
  "resume",
  "education",
  "experience",
  "savedAnswers",
]);
// Profile answers that are not fill keys but are still worth copying.
const EXTRA = [
  ["workCountry", "Country the eligibility answers are for"],
  ["workAuthorization", "Work authorization details"],
  ["sponsorship", "Sponsorship details"],
  ["noticePeriod", "Notice period"],
  ["availableFrom", "Available from"],
  ["preferredAnswers", "Other reusable answers"],
];
const dates = (e) => [e.startDate, e.endDate].filter(Boolean).join(" – ");

export function profileSections(applicant = {}, answers = []) {
  const fields = applicant.fields || {};
  const sections = [];
  const shown = new Set();
  for (const group of OPTION_GROUPS) {
    const rows = group.fields
      .filter(([key]) => !NOT_PROFILE.has(key) && fields[key])
      .map(([key, label]) => (shown.add(key), { label, value: fields[key] }));
    if (rows.length) sections.push({ title: group.title, rows });
  }
  const extra = EXTRA.filter(([key]) => fields[key] && !shown.has(key)).map(
    ([key, label]) => ({ label, value: fields[key] }),
  );
  if (extra.length) sections.push({ title: "More answers", rows: extra });

  for (const [title, list, main, sub] of [
    ["Work experience", applicant.experience, "company", "title"],
    ["Education", applicant.education, "school", "degree"],
  ]) {
    const rows = (list || []).flatMap((e) => {
      const head = [e[main], e[sub]].filter(Boolean).join(" · ");
      return [
        [`${title === "Education" ? "School" : "Company"}`, e[main]],
        [title === "Education" ? "Degree" : "Job title", e[sub]],
        ["Field of study", e.fieldOfStudy],
        ["Location", e.location],
        ["Dates", dates(e)],
        ["Description", e.description],
      ]
        .filter(([, value]) => value)
        .map(([label, value]) => ({ label, value, entry: head }));
    });
    if (rows.length) sections.push({ title, rows });
  }
  if (applicant.skills)
    sections.push({
      title: "Skills",
      rows: [{ label: "Skills", value: applicant.skills }],
    });
  // Drafts are never autofilled, so copying is the only way to reuse them.
  const saved = answers
    .filter((a) => a.answer)
    .map((a) => ({
      label: a.kind === "draft" ? `${a.question} (draft)` : a.question,
      value: a.answer,
    }));
  if (saved.length)
    sections.push({ title: "Saved from past forms", rows: saved });
  return sections;
}
