import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { autofill } from "../src/content/autofill.js";

// Synthetic copy of Workday's dropdown: a button showing "Select One" whose
// options only exist in a popup at the end of <body> once it is clicked.
function workdayPage(selected = "Select One") {
  const { window } = new JSDOM(`<form>
    <div data-automation-id="formField-countryRegion">
      <label for="input-7">Province or Territory</label>
      <button type="button" id="input-7" aria-haspopup="listbox"
        aria-label="Province or Territory ${selected}">${selected}</button>
    </div></form>`);
  const doc = window.document;
  const button = doc.getElementById("input-7");
  button.addEventListener("click", () => {
    if (doc.querySelector('[role="listbox"]')) return;
    const popup = doc.createElement("div");
    popup.innerHTML = `<ul role="listbox">${["Alberta", "Ontario", "Quebec"]
      .map((p) => `<li role="option"><div>${p}</div></li>`)
      .join("")}</ul>`;
    popup.addEventListener("click", (e) => {
      const li = e.target.closest('[role="option"]');
      if (!li) return;
      button.textContent = li.textContent;
      popup.remove();
    });
    doc.body.append(popup);
  });
  return { doc, button };
}

test("picks a province from a Workday listbox button", async () => {
  const { doc, button } = workdayPage();
  const report = await autofill(doc, { fields: { region: "ON" } });
  assert.equal(button.textContent, "Ontario");
  assert.equal(report.find((e) => e.key === "region")?.status, "filled");
  assert.equal(doc.querySelector('[role="listbox"]'), null, "popup closed");
});

test("keeps a province the user already picked", async () => {
  const { doc, button } = workdayPage("Quebec");
  const report = await autofill(doc, { fields: { region: "ON" } });
  assert.equal(button.textContent, "Quebec");
  assert.equal(report.find((e) => e.key === "region")?.status, "kept");
});
