// Bundles the extension into dist/ (Chrome: chrome://extensions → Load unpacked) and
// dist-firefox/ (Firefox: about:debugging → Load Temporary Add-on, or npm run firefox).
// --fixture also builds the local Greenhouse- and Ashby-like test forms into
// fixtures/dist/ (fixtures/lever.html is plain HTML).
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

// Firefox build: same code, manifest with a Gecko ID and no Chrome-only keys.
const firefoxManifest = () => {
  const manifest = JSON.parse(readFileSync("static/manifest.json", "utf8"));
  delete manifest.minimum_chrome_version;
  manifest.browser_specific_settings = {
    gecko: {
      id: "folio-autofill@folio.local",
      strict_min_version: "140.0",
      // Data only goes to the user's own Folio on 127.0.0.1, never to us.
      data_collection_permissions: { required: ["none"] },
    },
    gecko_android: { strict_min_version: "142.0" },
  };
  return JSON.stringify(manifest, null, 2);
};
const syncFirefox = () => {
  rmSync("dist-firefox", { recursive: true, force: true });
  cpSync("dist", "dist-firefox", { recursive: true });
  writeFileSync("dist-firefox/manifest.json", firefoxManifest());
};

const builds = [
  {
    entryPoints: ["src/content/main.js"],
    outfile: "dist/content.js",
    format: "iife",
  },
  { entryPoints: ["src/popup.js"], outfile: "dist/popup.js", format: "esm" },
];
if (fixture)
  for (const site of ["greenhouse", "ashby"])
    builds.push({
      entryPoints: [`fixtures/${site}.jsx`],
      outfile: `fixtures/dist/${site}.js`,
      format: "iife",
      define: { "process.env.NODE_ENV": '"development"' },
    });
const common = { bundle: true, target: "chrome116", logLevel: "info" };
const mirror = {
  name: "firefox-mirror",
  setup: (build) => build.onEnd(() => syncFirefox()),
};
if (watch) {
  for (const b of builds)
    await (
      await esbuild.context({ ...common, ...b, plugins: [mirror] })
    ).watch();
} else {
  await Promise.all(builds.map((b) => esbuild.build({ ...common, ...b })));
  syncFirefox();
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
