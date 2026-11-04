// Collects application-form questions from Greenhouse's public job board API
// (read only: boards-api.greenhouse.io, the same data the public job page shows).
// Writes forms.json: one entry per job, fields with label, type, name, options.
// Usage: node collect.mjs
import { writeFileSync } from "node:fs";

const BOARDS = [
  "gitlab",
  "stripe",
  "airbnb",
  "figma",
  "discord",
  "robinhood",
  "dropbox",
  "reddit",
  "databricks",
  "cloudflare",
  "datadog",
  "instacart",
  "lyft",
  "pinterest",
  "duolingo",
  "brex",
  "asana",
  "squarespace",
  "affirm",
  "gusto",
  "chime",
  "samsara",
  "mongodb",
  "elastic",
  "twilio",
  "okta",
  "roblox",
  "toast",
  "flexport",
  "scaleai",
  "anthropic",
  "coinbase",
  "doordashusa",
  "carta",
  "webflow",
  "grammarly",
  "vercel",
  "hubspot",
  "zscaler",
  "nuro",
  "faire",
  "benchling",
  "watershed",
  "andurilindustries",
  "spacex",
];
const PER_BOARD = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => {
  const res = await fetch(url, {
    headers: { "user-agent": "folio-field-eval" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

const forms = [];
for (const board of BOARDS) {
  try {
    const { jobs = [] } = await get(
      `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`,
    );
    for (const job of jobs.slice(0, PER_BOARD)) {
      await sleep(250);
      const d = await get(
        `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${job.id}?questions=true`,
      );
      const groups = [
        ...(d.questions || []),
        ...(d.location_questions || []),
        ...(d.compliance || []).flatMap((c) => c.questions || []),
        ...(d.demographic_questions?.questions || []).map((q) => ({
          label: q.label,
          fields: [
            {
              type: q.type,
              name: `demographic_${q.id}`,
              values: (q.answer_options || []).map((o) => ({ label: o.label })),
            },
          ],
        })),
      ];
      const fields = [];
      for (const q of groups)
        for (const f of q.fields || [])
          fields.push({
            label: String(q.label || "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim(),
            type: f.type,
            name: f.name,
            options: (f.values || [])
              .map((v) => String(v.label ?? v.value ?? ""))
              .filter(Boolean),
          });
      forms.push({ board, jobId: job.id, fields });
    }
    console.log(board, Math.min(jobs.length, PER_BOARD));
  } catch (e) {
    console.log(board, "skipped:", e.message);
  }
  await sleep(250);
}
writeFileSync("forms.json", JSON.stringify(forms, null, 1));
console.log(
  forms.length,
  "forms,",
  forms.reduce((n, f) => n + f.fields.length, 0),
  "fields",
);
