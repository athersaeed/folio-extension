// Dedupes questions and splits them by company: every 3rd board (alphabetical)
// is held out. Held-out questions that also appear on a practice board are
// dropped from held-out, so held-out is never seen while tuning.
import { readFileSync, writeFileSync } from "node:fs";
const forms = JSON.parse(readFileSync("forms.json", "utf8"));
const boards = [...new Set(forms.map((f) => f.board))].sort();
const heldBoards = new Set(boards.filter((_, i) => i % 3 === 2));
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const sets = { practice: new Map(), heldout: new Map() };
for (const f of forms)
  for (const x of f.fields) {
    if (x.type === "input_hidden") continue;
    const split = heldBoards.has(f.board) ? "heldout" : "practice";
    const k = `${norm(x.label)}|${x.type}`;
    if (!sets[split].has(k))
      sets[split].set(k, {
        label: x.label,
        type: x.type,
        name: x.name,
        options: x.options,
      });
  }
for (const k of sets.practice.keys()) sets.heldout.delete(k);
for (const [split, m] of Object.entries(sets)) {
  const items = [...m.values()].map((x, i) => ({
    id: `${split[0]}${i}`,
    ...x,
  }));
  writeFileSync(`${split}.unlabelled.json`, JSON.stringify(items, null, 1));
  console.log(split, items.length);
}
console.log("held-out boards:", [...heldBoards].join(" "));
