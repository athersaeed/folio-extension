// Matching form questions against the user's saved answers (Folio's answer bank).
// normalizeQuestion must stay identical to folio parser llm/src/answers.js,
// which uses it to de-duplicate saved questions.

export function normalizeQuestion(question) {
  return String(question || "")
    .toLowerCase()
    .replace(/\*/g, " ")
    .replace(/[^\p{L}\p{N}+]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "a an the you your are is do does did have has will would can could of to in for on at or and with this that be been as by please".split(
    " ",
  ),
);
const words = (q) =>
  new Set(
    normalizeQuestion(q)
      .split(" ")
      .filter((w) => w && !STOP.has(w)),
  );

function similarity(a, b) {
  const x = words(a),
    y = words(b);
  if (x.size < 3 || y.size < 3) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / (x.size + y.size - shared);
}

const sameCompany = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Returns { answer, exact } for the best saved answer, or null. Drafts (essays)
// are never offered for autofill. Close-but-not-identical wording comes back with
// exact: false so the page can ask the user to check it.
export function findSavedAnswer(bank, question, company = "") {
  const usable = (bank || []).filter(
    (a) =>
      a.kind !== "draft" &&
      (!a.company || (company && sameCompany(a.company, company))),
  );
  const target = normalizeQuestion(question);
  if (!target) return null;
  // Prefer an answer saved for this company over a general one.
  const exact = usable
    .filter((a) => normalizeQuestion(a.question) === target)
    .sort((a, b) => Number(!!b.company) - Number(!!a.company))[0];
  if (exact) return { answer: exact, exact: true };
  let best = null,
    score = 0;
  for (const a of usable) {
    const s = similarity(a.question, question);
    if (s > score) [best, score] = [a, s];
  }
  return score >= 0.75 ? { answer: best, exact: false } : null;
}

// Best guess at the hiring company, for tying company-specific answers to it.
export function detectCompany(doc) {
  // Greenhouse: "Job Application for <role> at <company>".
  const title = (doc.title || "").split(" | ")[0];
  const m = /\bapplication for .+ at (.+)$/i.exec(title);
  if (m) return m[1].trim();
  const { hostname, pathname } = doc.location || {};
  // Ashby: "<role> @ <company>". Lever: "<company> - <role>".
  const ashby = /^.+ @ (.+)$/.exec(title);
  if (ashby && /ashbyhq\.com$/.test(hostname || "")) return ashby[1].trim();
  const lever = /^(.+?) - .+$/.exec(title);
  if (lever && /lever\.co$/.test(hostname || "")) return lever[1].trim();
  const site = doc
    .querySelector('meta[property="og:site_name"]')
    ?.getAttribute("content");
  if (site && !/greenhouse|lever|ashby|workday/i.test(site)) return site.trim();
  if (/greenhouse\.io|lever\.co|ashbyhq\.com/.test(hostname || "")) {
    const slug = (pathname || "").split("/").filter(Boolean)[0];
    if (slug) return slug.replace(/[-_]+/g, " ");
  }
  return "";
}
