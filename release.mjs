// Signs the current version, attaches the .xpi to a GitHub release and lists
// it in updates.json, which installed copies of the add-on check for updates.
// Bump "version" in static/manifest.json and package.json first.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  copyFileSync,
} from "node:fs";

const REPO = "athersaeed/folio-extension";
const ID = "folio-autofill@folio.local";
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const out = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();

const { version } = JSON.parse(readFileSync("static/manifest.json", "utf8"));
const tag = `v${version}`;
const updates = JSON.parse(readFileSync("updates.json", "utf8"));
const list = updates.addons[ID].updates;
if (list.some((u) => u.version === version))
  throw new Error(`${version} is already released; bump the version first`);
if (out("git", ["status", "--porcelain", "--untracked-files=no"]))
  throw new Error("commit your changes first");

run("npm", ["test"]);
run("npm", ["run", "sign:firefox"]);
const signed = readdirSync("web-ext-artifacts").find((f) =>
  f.endsWith(`-${version}.xpi`),
);
if (!signed) throw new Error(`no signed .xpi for ${version}`);
const asset = `web-ext-artifacts/folio-autofill-${version}.xpi`;
copyFileSync(`web-ext-artifacts/${signed}`, asset);
const hash = createHash("sha256").update(readFileSync(asset)).digest("hex");

// Push first so the release tag points at the released code.
run("git", ["push", "origin", "HEAD"]);
run("gh", [
  "release",
  "create",
  tag,
  asset,
  "--repo",
  REPO,
  "--title",
  `Folio Autofill ${version}`,
  "--notes",
  "Signed Firefox build. Installed copies update themselves.",
]);

list.push({
  version,
  update_link: `https://github.com/${REPO}/releases/download/${tag}/folio-autofill-${version}.xpi`,
  update_hash: `sha256:${hash}`,
});
writeFileSync("updates.json", JSON.stringify(updates, null, 2) + "\n");
run("git", ["add", "updates.json"]);
run("git", [
  "commit",
  "-m",
  `Release ${version}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`,
]);
run("git", ["push", "origin", "HEAD"]);
console.log(
  `Released ${version}; Firefox will pick it up on its next update check.`,
);
