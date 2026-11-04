// Scores the extension's rules classifier (src/classify.js) on a labelled split.
// Usage: node score-rules.mjs practice   (heldout is scored once, by compare.mjs)
import { readFileSync } from "node:fs";
import { classify } from "../../src/classify.js";
export const KIND = {
  input_text: "text",
  textarea: "textarea",
  input_file: "file",
  multi_value_single_select: "select",
  multi_value_multi_select: "select",
};
export const rulesKey = (x) =>
  classify({ label: x.label, name: x.name, kind: KIND[x.type] || "text" }) ||
  "none";
export function tally(items, pick) {
  const t = { right: 0, wrong: 0, missed: 0, wrongs: [], misses: [] };
  for (const x of items) {
    const got = pick(x);
    if (x.gold.includes(got)) t.right++;
    else if (got === "none") {
      t.missed++;
      t.misses.push(x);
    } else {
      t.wrong++;
      t.wrongs.push({ ...x, got });
    }
  }
  return t;
}
if (process.argv[1]?.endsWith("score-rules.mjs")) {
  const split = process.argv[2] || "practice";
  if (split !== "practice")
    throw new Error("Score held-out only through compare.mjs.");
  const items = JSON.parse(readFileSync(`${split}.json`, "utf8"));
  const t = tally(items, rulesKey);
  console.log(
    `rules: ${t.right}/${items.length} right, ${t.wrong} wrong, ${t.missed} missed`,
  );
  for (const w of t.wrongs)
    console.log(
      "WRONG",
      w.id,
      w.got,
      "should be",
      w.gold.join("|"),
      "-",
      w.label.slice(0, 90),
    );
  for (const m of t.misses)
    console.log("MISS ", m.id, m.gold.join("|"), "-", m.label.slice(0, 90));
}
