// Bundles the extension into dist/ (load it via chrome://extensions → Load unpacked).
// --fixture also builds the local Greenhouse-like test form into fixtures/dist/.
import * as esbuild from "esbuild";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

const watch = process.argv.includes("--watch");
const fixture = process.argv.includes("--fixture");
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
cpSync("static", "dist", { recursive: true });

const builds = [
  {
    entryPoints: ["src/content/main.js"],
    outfile: "dist/content.js",
    format: "iife",
  },
  { entryPoints: ["src/popup.js"], outfile: "dist/popup.js", format: "esm" },
];
if (fixture)
  builds.push({
    entryPoints: ["fixtures/greenhouse.jsx"],
    outfile: "fixtures/dist/greenhouse.js",
    format: "iife",
    define: { "process.env.NODE_ENV": '"development"' },
  });
const common = { bundle: true, target: "chrome116", logLevel: "info" };
if (watch) {
  for (const b of builds)
    await (await esbuild.context({ ...common, ...b })).watch();
} else {
  await Promise.all(builds.map((b) => esbuild.build({ ...common, ...b })));
  if (fixture) {
    cpSync("dist/content.js", "fixtures/dist/content.js");
    // Popup preview: the real popup with chrome.* stubbed (fixtures/chrome-stub.js).
    cpSync("dist", "fixtures/dist/popup", { recursive: true });
    cpSync("fixtures/chrome-stub.js", "fixtures/dist/popup/chrome-stub.js");
    const html = readFileSync("dist/popup.html", "utf8").replace(
      '<script type="module"',
      '<script src="chrome-stub.js"></script>\n    <script type="module"',
    );
    writeFileSync("fixtures/dist/popup/index.html", html);
  }
}
