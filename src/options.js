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

export function matchOption(options, value, key = "") {
  const wanted = clean(value);
  if (!wanted) return -1;
  const list = options.map(clean);
  const real = (i) =>
    list[i] && !/^(select|choose|please select|--)/.test(list[i]);
  let i = list.findIndex((o, n) => real(n) && o === wanted);
  if (i >= 0) return i;
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
