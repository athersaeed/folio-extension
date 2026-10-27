import { test } from "node:test";
import assert from "node:assert/strict";
import { isFolioPage } from "../src/pages.js";

test("recognises Folio's own tab on any loopback name, same port only", () => {
  const folio = "http://127.0.0.1:5174";
  assert.equal(isFolioPage("http://127.0.0.1:5174/", folio), true);
  assert.equal(isFolioPage("http://localhost:5174/#profile", folio), true);
  assert.equal(isFolioPage("http://[::1]:5174/", folio), true);
  assert.equal(
    isFolioPage("http://127.0.0.1:5190/greenhouse.html", folio),
    false,
    "other local apps can be filled",
  );
  assert.equal(
    isFolioPage("https://job-boards.greenhouse.io/acme/jobs/1", folio),
    false,
  );
  assert.equal(isFolioPage(undefined, folio), false);
  assert.equal(isFolioPage("about:blank", folio), false);
});
