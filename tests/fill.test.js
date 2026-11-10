import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fillText } from "../src/content/fill.js";

// Workday validates on blur against the value it last rendered. The blur has
// to arrive after the input event has been handled in an earlier tick, and it
// has to arrive at all when focus()/blur() are no-ops (page window unfocused).
test("fillText blurs after the input settles, even without real focus", async () => {
  const { window } = new JSDOM(`<input id="f">`);
  const el = window.document.getElementById("f");
  el.focus = el.blur = () => {}; // what an unfocused window gives us
  let committed = "";
  const log = [];
  el.addEventListener("focusin", () => log.push("focusin"));
  el.addEventListener("input", () => {
    log.push("input");
    setTimeout(() => (committed = el.value), 0); // state lands next tick
  });
  el.addEventListener("focusout", () => log.push(`focusout:${committed}`));
  assert.equal(await fillText(el, "Syed"), true);
  assert.deepEqual(log, ["focusin", "input", "focusout:Syed"]);
});

test("fillText does not double-fire focus events when focus works", async () => {
  const { window } = new JSDOM(`<input id="f">`);
  const el = window.document.getElementById("f");
  let blurs = 0;
  el.addEventListener("blur", () => blurs++);
  await fillText(el, "x");
  assert.equal(blurs, 1);
});
