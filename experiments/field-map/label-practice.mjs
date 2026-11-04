// Gold labels for practice.unlabelled.json, written by hand from the questions.
// A value is the profile key the field should map to; an array lists every
// acceptable answer for genuinely ambiguous fields. Unlisted ids are "none".
// Rules used: school/degree/current company and title are resume entries
// (entries.js), not profile keys, so "none" here; compound or location-specific
// yes/no questions ("Are you based in Japan?") are "none".
import { readFileSync, writeFileSync } from "node:fs";
const L = {
  firstName: [0],
  lastName: [1],
  email: [2],
  phone: [3],
  resume: [4],
  preferredName: [28, 107, 142, 198],
  name: [239],
  pronouns: [25, 111, 199, 220],
  location: [18, 321],
  country: [171],
  region: [76, 86, 146],
  postalCode: [155, 188, 263],
  addressLine1: [326],
  linkedin: [19, 74, 228],
  github: [148],
  website: [35, 110, 150],
  workAuthorized: [
    13, 21, 29, 37, 52, 55, 64, 75, 87, 93, 140, 157, 172, 187, 230, 243, 260,
    268, 297, 312, 318, 328,
  ],
  requiresSponsorship: [
    14, 53, 65, 77, 83, 88, 94, 113, 127, 144, 145, 158, 173, 184, 203, 214,
    218, 231, 244, 261, 267, 279, 280, 298, 304, 305, 313, 319, 329,
  ],
  willingToRelocate: [281],
  startDate: [275],
  howHeard: [20, 36, 98, 147, 156, 191, 192, 208, 229, 246, 265, 293, 316],
  gender: [
    12, 33, 45, 58, 79, 101, 119, 120, 153, 164, 176, 212, 217, 235, 256, 270,
    309, 327,
  ],
  hispanicLatino: [122, 213],
  race: [
    32, 42, 46, 63, 81, 90, 102, 121, 138, 154, 167, 181, 195, 236, 264, 271,
    310,
  ],
  veteranStatus: [31, 43, 62, 82, 106, 123, 168, 179, 196, 237, 258, 272],
  disabilityStatus: [44, 61, 105, 169, 180, 197, 257, 311],
};
const ALT = {
  5: ["none", "resume"],
  23: ["website", "none"],
  27: ["location", "none"],
  39: ["none", "willingToRelocate"],
  112: ["pronouns", "none"],
  124: ["region", "location"],
  182: ["none", "lastName"],
  245: ["startDate", "none"],
  259: ["startDate", "none"],
  282: ["addressLine1", "none"],
  286: ["none", "willingToRelocate"],
};
const gold = new Map();
for (const [key, ids] of Object.entries(L))
  for (const i of ids) gold.set(`p${i}`, [key]);
for (const [i, keys] of Object.entries(ALT)) gold.set(`p${i}`, keys);
const items = JSON.parse(readFileSync("practice.unlabelled.json", "utf8"));
const out = items.map((x) => ({ ...x, gold: gold.get(x.id) || ["none"] }));
writeFileSync("practice.json", JSON.stringify(out, null, 1));
const n = out.filter((x) => x.gold[0] !== "none").length;
console.log(out.length, "practice fields,", n, "with a profile key");
