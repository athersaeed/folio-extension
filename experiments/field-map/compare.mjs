// Compares OpenRouter models at mapping application-form fields to Folio
// profile keys, against the rules classifier.
//   node --env-file="../../../folio parser llm/.env" compare.mjs practice
//   ... compare.mjs heldout --models a,b      (score held-out once, named models)
// Only field labels, types and option text are sent, never profile values.
// Stops starting new calls once spend reaches BUDGET_USD.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { rulesKey, tally, KIND } from "./score-rules.mjs";

const BUDGET_USD = 1;
const BATCH = 25;
const CONCURRENCY = 4;
const MODELS = [
  { id: "google/gemma-4-26b-a4b-it", reasoning: { enabled: false } },
  {
    id: "anthropic/claude-haiku-5.5",
    reasoning: { effort: "none" },
    temperature: null,
  },
  { id: "mistralai/ministral-8b-2512" },
  { id: "mistralai/ministral-3b-2512" },
  { id: "nvidia/nemotron-3.5-lightning", reasoning: { enabled: false } },
  { id: "nvidia/nemotron-3-nano-30b-a3b", reasoning: { enabled: false } },
  { id: "inference-net/schematron-v2-turbo" },
];
const KEYS = {
  firstName: "applicant's first / given name",
  lastName: "applicant's last / family name",
  preferredName: "name the applicant prefers to be called",
  name: "applicant's full or legal name in one box",
  pronouns: "applicant's pronouns",
  email: "applicant's email address",
  phone: "applicant's phone number",
  location: "where the applicant lives, as free text (city, or city and state)",
  country: "country the applicant lives in",
  addressLine1: "street address",
  addressLine2: "apartment / suite / unit",
  city: "city, as its own address field",
  region: "state or province the applicant lives in",
  postalCode: "postal or ZIP code",
  linkedin: "LinkedIn profile URL",
  github: "GitHub profile URL",
  website: "personal website or portfolio URL",
  resume: "resume / CV file upload",
  workAuthorized: "is the applicant legally authorized to work (yes/no)",
  requiresSponsorship:
    "does the applicant need visa / immigration sponsorship, now or in future (yes/no)",
  salaryExpectation: "expected or desired salary / compensation",
  startDate: "earliest date the applicant can start",
  willingToRelocate: "is the applicant willing to relocate (yes/no)",
  howHeard: "how the applicant heard about the job or company",
  gender: "gender or sex (voluntary self-identification)",
  hispanicLatino:
    "is the applicant Hispanic or Latino (yes/no), asked separately from race",
  race: "race or ethnicity (voluntary self-identification)",
  veteranStatus: "veteran or military status",
  disabilityStatus: "disability status",
};
const PROMPT = `You map job application form fields to an applicant profile.
For each field, answer with the one profile key whose saved answer would correctly fill it, or "none".
Answer "none" when no key fits exactly: cover letters, essays, "why us", skills or experience questions,
school, degree, current employer or title, consent and privacy checkboxes, "have you worked here before",
questions about someone other than the applicant, follow-up "please explain" boxes, and yes/no questions
about one specific place (e.g. "Are you based in Japan?"). A wrong key is worse than "none".

Profile keys:
${Object.entries(KEYS)
  .map(([k, d]) => `- ${k}: ${d}`)
  .join("\n")}`;
const ENUM = [...Object.keys(KEYS), "none"];
const SCHEMA = {
  name: "field_map",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["answers"],
    properties: {
      answers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "key"],
          properties: {
            id: { type: "string" },
            key: { type: "string", enum: ENUM },
          },
        },
      },
    },
  },
};
const describe = (x) => {
  const o = x.options.length
    ? `\n  options (${x.options.length}): ${x.options
        .slice(0, 12)
        .map((s) => s.slice(0, 60))
        .join(" | ")}${x.options.length > 12 ? " | ..." : ""}`
    : "";
  return `${x.id} [${KIND[x.type] || x.type}] ${x.label.slice(0, 400)}${o}`;
};

let spent = 0;
async function callModel(model, batch) {
  if (spent >= BUDGET_USD) throw new Error("budget reached");
  const body = {
    model: model.id,
    messages: [
      { role: "system", content: PROMPT },
      { role: "user", content: `Fields:\n${batch.map(describe).join("\n")}` },
    ],
    response_format: { type: "json_schema", json_schema: SCHEMA },
    provider: { data_collection: "deny", require_parameters: true },
    usage: { include: true },
    max_tokens: 2000,
  };
  if (model.temperature !== null) body.temperature = 0;
  if (model.reasoning) body.reasoning = model.reasoning;
  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const json = await res.json().catch(() => ({}));
  spent += json.usage?.cost || 0;
  if (!res.ok)
    throw new Error(`${res.status} ${json.error?.message || ""}`.slice(0, 200));
  const text = json.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
  const out = new Map();
  for (const a of parsed.answers || [])
    if (ENUM.includes(a.key)) out.set(a.id, a.key);
  return { out, ms, cost: json.usage?.cost || 0 };
}

async function runModel(model, items) {
  const batches = [];
  for (let i = 0; i < items.length; i += BATCH)
    batches.push(items.slice(i, i + BATCH));
  const answers = new Map();
  const stats = { calls: 0, failed: 0, ms: [], cost: 0, errors: [] };
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const batch = batches[next++];
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { out, ms, cost } = await callModel(model, batch);
          stats.calls++;
          stats.ms.push(ms);
          stats.cost += cost;
          for (const [k, v] of out) answers.set(k, v);
          break;
        } catch (e) {
          if (attempt === 1 || e.message === "budget reached") {
            stats.failed++;
            stats.errors.push(e.message);
            break;
          }
        }
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { answers, stats };
}

const split = process.argv[2] || "practice";
const wanted = process.argv.includes("--models")
  ? process.argv[process.argv.indexOf("--models") + 1].split(",")
  : null;
if (split === "heldout" && !wanted)
  throw new Error("Held-out needs an explicit --models list, scored once.");
if (!process.env.OPENROUTER_API_KEY)
  throw new Error("OPENROUTER_API_KEY missing.");
const items = JSON.parse(readFileSync(`${split}.json`, "utf8"));
const models = wanted
  ? wanted.map((id) => MODELS.find((m) => m.id === id) || { id })
  : MODELS;

const rows = [];
const rules = tally(items, rulesKey);
rows.push({
  approach: "rules only",
  ...rules,
  medianMs: 0,
  cost: 0,
  failed: 0,
});
const detail = {};
for (const model of models) {
  const { answers, stats } = await runModel(model, items);
  const llm = (x) => answers.get(x.id) || "none";
  const all = tally(items, llm);
  const hybrid = tally(items, (x) => {
    const r = rulesKey(x);
    return r !== "none" ? r : llm(x);
  });
  // agree: a rules match fills only if the model gives the same key; blanks use the model.
  const agree = tally(items, (x) => {
    const r = rulesKey(x),
      l = llm(x);
    return r === "none" ? l : l === r ? r : "none";
  });
  // strict: fill only when rules and model give the same key.
  const strict = tally(items, (x) => {
    const r = rulesKey(x);
    return r !== "none" && llm(x) === r ? r : "none";
  });
  const ms =
    stats.ms.sort((a, b) => a - b)[Math.floor(stats.ms.length / 2)] || 0;
  const base = { medianMs: ms, cost: stats.cost, failed: stats.failed };
  rows.push({ approach: `rules + ${model.id} on blanks`, ...hybrid, ...base });
  rows.push({ approach: `${model.id} on every field`, ...all, ...base });
  rows.push({
    approach: `${model.id} agree (model fills blanks)`,
    ...agree,
    ...base,
  });
  rows.push({ approach: `${model.id} strict agree`, ...strict, ...base });
  detail[model.id] = {
    stats,
    answers: Object.fromEntries(answers),
    agree: { wrongs: agree.wrongs.map((w) => [w.id, w.got, w.gold]) },
    strict: {
      wrongs: strict.wrongs.map((w) => [w.id, w.got, w.gold]),
      misses: strict.misses.map((m) => m.id),
    },
    hybrid: {
      wrongs: hybrid.wrongs.map((w) => [w.id, w.got, w.gold]),
      misses: hybrid.misses.map((m) => m.id),
    },
    all: {
      wrongs: all.wrongs.map((w) => [w.id, w.got, w.gold]),
      misses: all.misses.map((m) => m.id),
    },
  };
  console.log(
    `${model.id}: every-field ${all.right}/${items.length} (${all.wrong} wrong), hybrid ${hybrid.right} (${hybrid.wrong} wrong), ${ms} ms, $${stats.cost.toFixed(4)}, failed ${stats.failed}${stats.errors[0] ? " — " + stats.errors[0] : ""}`,
  );
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync("results", { recursive: true });
writeFileSync(
  `results/${split}-${stamp}.json`,
  JSON.stringify(
    {
      split,
      prompt: PROMPT,
      rows: rows.map(({ wrongs, misses, ...r }) => r),
      detail,
    },
    null,
    1,
  ),
);
console.log(
  `\n| Approach | Right | Wrong | Missed | Median ms | Cost USD |\n|---|---|---|---|---|---|`,
);
for (const r of rows)
  console.log(
    `| ${r.approach} | ${r.right}/${items.length} | ${r.wrong} | ${r.missed} | ${r.medianMs || "—"} | ${r.cost.toFixed(4)} |`,
  );
console.log(`\nTotal spent: $${spent.toFixed(4)}`);
