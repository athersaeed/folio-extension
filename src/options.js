// Picks which visible option of a select / combobox / radio group means the same
// as the user's saved answer. Returns the option index, or -1 when unsure.
import { normalize } from "./classify.js";

const DECLINE =
  /\b(decline|declined|prefer not|not (wish|want|like) to|don'?t (wish|want)|do not (wish|want)|choose not|rather not|not to (answer|disclose|say|specify))\b/;
const COUNTRY_ALIASES = [
  [
    "united states",
    "united states of america",
    "usa",
    "us",
    "u s",
    "u s a",
    "america",
  ],
  ["united kingdom", "uk", "u k", "great britain", "britain", "england"],
  ["united arab emirates", "uae"],
  ["south korea", "korea, republic of", "republic of korea", "korea"],
];
// Province / state abbreviations, so "ON" picks "Ontario" in a dropdown.
const REGIONS = Object.entries({
  ab: "alberta",
  bc: "british columbia",
  mb: "manitoba",
  nb: "new brunswick",
  nl: "newfoundland and labrador",
  ns: "nova scotia",
  nt: "northwest territories",
  nu: "nunavut",
  on: "ontario",
  pe: "prince edward island",
  qc: "quebec",
  sk: "saskatchewan",
  yt: "yukon",
  al: "alabama",
  ak: "alaska",
  az: "arizona",
  ar: "arkansas",
  ca: "california",
  co: "colorado",
  ct: "connecticut",
  de: "delaware",
  dc: "district of columbia",
  fl: "florida",
  ga: "georgia",
  hi: "hawaii",
  id: "idaho",
  il: "illinois",
  in: "indiana",
  ia: "iowa",
  ks: "kansas",
  ky: "kentucky",
  la: "louisiana",
  me: "maine",
  md: "maryland",
  ma: "massachusetts",
  mi: "michigan",
  mn: "minnesota",
  ms: "mississippi",
  mo: "missouri",
  mt: "montana",
  ne: "nebraska",
  nv: "nevada",
  nh: "new hampshire",
  nj: "new jersey",
  nm: "new mexico",
  ny: "new york",
  nc: "north carolina",
  nd: "north dakota",
  oh: "ohio",
  ok: "oklahoma",
  or: "oregon",
  pa: "pennsylvania",
  ri: "rhode island",
  sc: "south carolina",
  sd: "south dakota",
  tn: "tennessee",
  tx: "texas",
  ut: "utah",
  vt: "vermont",
  va: "virginia",
  wa: "washington",
  wv: "west virginia",
  wi: "wisconsin",
  wy: "wyoming",
});
const clean = (s) =>
  normalize(s)
    .replace(/[.,'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
function countryGroup(text) {
  const t = clean(text);
  return COUNTRY_ALIASES.findIndex((group) =>
    group.some((a) => clean(a) === t),
  );
}

// Degree level, so "Bachelor of Science" picks "Bachelor's Degree". MBA, JD and
// MD are checked before the broader master's / doctorate levels.
const DEGREES = [
  ["mba", /\bm ?b ?a\b|\bmaster of business administration\b/],
  ["jd", /\bj ?d\b|\bjuris doctor\b/],
  ["md", /\bm ?d\b|\bdoctor of medicine\b/],
  ["phd", /\bph ?d\b|\bdoctor(ate)? of philosophy\b|\bdoctorate\b/],
  ["master", /\bmasters?\b|\bm ?sc?\b|\bm ?eng\b|\bm ?a\b/],
  [
    "bachelor",
    /\bbachelors?\b|\bb ?sc?\b|\bb ?eng\b|\bb ?a\b|\bb ?comm?\b|\bb ?tech\b|\bundergrad/,
  ],
  ["associate", /\bassociates?\b|\ba ?a ?s?\b/],
  ["highschool", /\bhigh school\b|\bsecondary\b|\bged\b|\bdiploma\b/],
];
const degreeLevel = (t) => DEGREES.find(([, re]) => re.test(t))?.[0] || null;
const MONTH_NAMES = [
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
// "September" ↔ "Sep" ↔ "09" ↔ "9".
function monthNumber(t) {
  if (/^\d{1,2}$/.test(t))
    return Number(t) >= 1 && Number(t) <= 12 ? Number(t) : 0;
  const i = MONTH_NAMES.findIndex((m) => t.length >= 3 && m.startsWith(t));
  return i + 1;
}

export function matchOption(options, value, key = "") {
  const wanted = clean(value);
  if (!wanted) return -1;
  const list = options.map(clean);
  const real = (i) =>
    list[i] && !/^(select|choose|please select|--)/.test(list[i]);
  let i = list.findIndex((o, n) => real(n) && o === wanted);
  if (i >= 0) return i;
  // A near-miss school is a different school: exact names only.
  if (key === "school" || key === "startYear" || key === "endYear") return -1;
  if (key === "startMonth" || key === "endMonth") {
    const m = monthNumber(wanted);
    return m ? list.findIndex((o, n) => real(n) && monthNumber(o) === m) : -1;
  }
  if (key === "degree") {
    const level = degreeLevel(wanted);
    if (!level) return -1;
    const hits = list
      .map((o, n) => (real(n) && degreeLevel(o) === level ? n : -1))
      .filter((n) => n >= 0);
    return hits.length === 1 ? hits[0] : -1;
  }
  if (DECLINE.test(wanted))
    return list.findIndex((o, n) => real(n) && DECLINE.test(o));
  if (/^(yes|no)\b/.test(wanted)) {
    const word = wanted.startsWith("yes") ? "yes" : "no";
    const hits = list.filter(
      (o, n) => real(n) && new RegExp(`^${word}\\b`).test(o),
    );
    // Several "Yes, ..." variants means the question needs a human decision.
    return hits.length === 1 ? list.indexOf(hits[0]) : -1;
  }
  if (key === "pronouns") {
    // "he" or "he/him" picks "He/him/his": the leading pronoun decides.
    const lead = (t) => t.split(/[\s/]+/)[0];
    const hits = list
      .map((o, n) => (real(n) && lead(o) === lead(wanted) ? n : -1))
      .filter((n) => n >= 0);
    if (hits.length === 1) return hits[0];
  }
  if (key === "region") {
    // Both spellings of one place; a code shared by two countries ("CA") picks
    // whichever of them the list actually offers.
    const names = new Set([wanted]);
    for (const [code, name] of REGIONS)
      if (code === wanted || name === wanted) names.add(code).add(name);
    i = list.findIndex((o, n) => real(n) && names.has(o));
    if (i >= 0) return i;
  }
  if (key === "location") {
    i = matchLocation(options, value);
    if (i >= 0) return i;
  }
  if (key === "country" || key === "location") {
    const group = countryGroup(wanted);
    if (group >= 0) {
      i = list.findIndex((o, n) => real(n) && countryGroup(o) === group);
      if (i >= 0) return i;
    }
  }
  // Last resort: one option that contains the whole answer or vice versa.
  if (wanted.length >= 4) {
    const hits = list
      .map((o, n) =>
        real(n) && o.length >= 3 && (o.includes(wanted) || wanted.includes(o))
          ? n
          : -1,
      )
      .filter((n) => n >= 0);
    if (hits.length === 1) return hits[0];
  }
  return -1;
}

// "Toronto, ON" vs search results like "Toronto, Ontario, Canada": the city must
// match exactly, and a given region must start a word in the rest ("ON" →
// "Ontario"). Several hits that all fit keep the provider's ranking.
function matchLocation(options, value) {
  const [city, ...rest] = String(value).split(",").map(clean).filter(Boolean);
  if (!city) return -1;
  const regions = rest.flatMap((r) => r.split(" "));
  const fits = options
    .map((o, n) => {
      const [first, ...others] = String(o).split(",").map(clean);
      if (first !== city) return -1;
      const words = others.join(" ").split(" ");
      const ok = regions.every((r) => words.some((w) => w.startsWith(r)));
      return ok ? n : -1;
    })
    .filter((n) => n >= 0);
  if (!fits.length) return -1;
  // Without a region, only an unambiguous city is safe.
  return regions.length || fits.length === 1 ? fits[0] : -1;
}
