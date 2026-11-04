// Gold labels for heldout.unlabelled.json, same rules as label-practice.mjs.
// Written before any model or prompt saw these questions; score once.
import { readFileSync, writeFileSync } from "node:fs";
const L = {
  firstName: [29, 124],
  lastName: [125],
  preferredName: [0],
  name: [43],
  pronouns: [30, 57, 68],
  country: [1, 6, 9, 71, 92],
  region: [101],
  postalCode: [32, 60],
  workAuthorized: [11, 14, 72, 79, 94, 100, 113],
  requiresSponsorship: [4, 12, 15, 33, 45, 47, 80, 93, 114],
  howHeard: [34, 69, 96, 104, 122],
  gender: [53, 107],
  race: [23, 106],
  veteranStatus: [24, 108],
  disabilityStatus: [25, 99, 109],
};
const ALT = {
  31: ["location", "region", "country"],
  41: ["workAuthorized", "requiresSponsorship"],
  44: ["linkedin", "website", "none"],
  50: ["workAuthorized", "requiresSponsorship"],
  55: ["workAuthorized", "requiresSponsorship"],
  61: ["willingToRelocate", "none"],
  66: ["willingToRelocate", "none"],
  67: ["website", "github"],
  74: ["willingToRelocate", "none"],
  76: ["none", "willingToRelocate"],
};
const gold = new Map();
for (const [key, ids] of Object.entries(L))
  for (const i of ids) gold.set(`h${i}`, [key]);
for (const [i, keys] of Object.entries(ALT)) gold.set(`h${i}`, keys);
const items = JSON.parse(readFileSync("heldout.unlabelled.json", "utf8"));
const out = items.map((x) => ({ ...x, gold: gold.get(x.id) || ["none"] }));
writeFileSync("heldout.json", JSON.stringify(out, null, 1));
console.log(
  out.length,
  "held-out fields,",
  out.filter((x) => x.gold[0] !== "none").length,
  "with a profile key",
);
