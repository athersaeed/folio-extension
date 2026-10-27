// Repeating resume sections on application forms: education (school, degree,
// discipline, dates) and employment (company, title, dates, current role).
// Fields are grouped into entries by document order: a field kind that repeats
// within a section starts that section's next entry, so the nth "School" box
// gets the nth school on the resume.
import { normalize } from "./classify.js";

const RULES = [
  {
    key: "school",
    section: "education",
    re: /^(school|school name|university|college|institution)( name)?$/,
  },
  {
    key: "degree",
    section: "education",
    re: /^(degree|degree type|degree level)$/,
  },
  {
    key: "discipline",
    section: "education",
    re: /^(discipline|major|field of study|area of study)$/,
  },
  {
    key: "company",
    section: "experience",
    re: /^(company|company name|employer|employer name)$/,
  },
  {
    key: "title",
    section: "experience",
    re: /^(title|job title|position|role|position title)$/,
  },
  {
    key: "current",
    section: "experience",
    re: /^(current role|i currently work here|current(ly)? (employed|working) here|current position)$/,
  },
  // Dates belong to whichever section the entry around them is in.
  { key: "startMonth", re: /^start (date )?month$/ },
  { key: "startYear", re: /^start (date )?year$/ },
  { key: "endMonth", re: /^end (date )?month$/ },
  { key: "endYear", re: /^end (date )?year$/ },
];

export function entryKind(field) {
  for (const text of [
    normalize(field.label),
    normalize(`${field.id} ${field.name}`)
      .replace(/\b\d+\b/g, "")
      .trim(),
  ]) {
    if (!text) continue;
    const rule = RULES.find((r) => r.re.test(text));
    if (rule) return rule;
  }
  return null;
}

// Fields in document order → Map(field → { section, index, key }).
export function assignEntries(fields) {
  const out = new Map();
  const count = { education: 0, experience: 0 };
  const open = {};
  let last = null;
  for (const field of fields) {
    const rule = entryKind(field);
    if (!rule) continue;
    const section = rule.section || last;
    if (!section) continue;
    let entry = open[section];
    if (!entry || entry.keys.has(rule.key)) {
      entry = open[section] = { index: count[section]++, keys: new Set() };
    }
    entry.keys.add(rule.key);
    out.set(field, { section, index: entry.index, key: rule.key });
    last = section;
  }
  return { entries: out, count };
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const PRESENT = /^(present|current|now|ongoing|today)$/i;

// "September 2022", "Sep. 2022", "09/2022", "2022-09", "2022", "Present".
export function parseDate(text) {
  const t = String(text || "")
    .trim()
    .toLowerCase();
  if (!t) return null;
  if (PRESENT.test(t)) return { present: true };
  const year = t.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!year) return null;
  let month = null;
  const word = t.match(/[a-z]{3,}/)?.[0];
  if (word) {
    const i = MONTHS.findIndex((m) => m.startsWith(word.slice(0, 3)));
    if (i >= 0) month = i + 1;
  } else {
    const n = t.replace(year, "").match(/\b(0?[1-9]|1[0-2])\b/)?.[0];
    if (n) month = Number(n);
  }
  return { year, month };
}

export const monthName = (n) =>
  MONTHS[n - 1][0].toUpperCase() + MONTHS[n - 1].slice(1);

// The answer for one entry field, as text (or true/false for "current role").
export function entryValue(applicant, { section, index, key }) {
  const item = applicant[section]?.[index];
  if (!item) return null;
  const start = parseDate(item.startDate);
  const end = parseDate(item.endDate);
  switch (key) {
    case "school":
      return item.school || null;
    case "degree":
      return item.degree || null;
    case "discipline":
      return item.fieldOfStudy || null;
    case "company":
      return item.company || null;
    case "title":
      return item.title || null;
    case "current":
      return !!end?.present;
    case "startMonth":
      return start?.month ? monthName(start.month) : null;
    case "startYear":
      return start?.year || null;
    case "endMonth":
      return end?.month ? monthName(end.month) : null;
    case "endYear":
      return end?.year || null;
  }
  return null;
}
