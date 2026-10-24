// One autofill pass over a document: detect fields, match them to profile keys,
// fill what the user has saved answers for, and report everything else.
// Never submits, never overwrites a field that already has a value.
import { classify } from "../classify.js";
import { collectFields } from "./fields.js";
import {
  hasValue,
  fillText,
  fillSelect,
  fillRadio,
  fillCombobox,
  attachFile,
} from "./fill.js";

const MARK = "data-folio-autofill";

function mark(el, status) {
  el.setAttribute(MARK, status);
  el.style.outline =
    status === "filled" ? "2px solid #5f9c58" : "2px solid #d39b38";
  el.style.outlineOffset = "1px";
}

export async function autofill(doc, applicant, file) {
  const report = [];
  const values = applicant.fields || {};
  for (const field of collectFields(doc)) {
    const profileKey = classify(field);
    const entry = {
      label:
        field.label.slice(0, 120) || field.name || field.id || "(unlabeled)",
      key: profileKey,
      kind: field.kind,
      required: field.required,
    };
    report.push(entry);
    const target =
      field.kind === "radio"
        ? field.options[0].el.closest("fieldset, [role=radiogroup]") ||
          field.options[0].el
        : field.kind === "combobox"
          ? field.el.closest('[class*="control"]') || field.el
          : field.el;
    if (!profileKey) {
      entry.status = "unmatched";
      if (field.required && !hasValue(field)) mark(target, "attention");
      continue;
    }
    if (hasValue(field)) {
      entry.status = "kept";
      continue;
    }
    if (profileKey === "resume") {
      entry.status = file
        ? attachFile(field.el, file)
          ? "filled"
          : "failed"
        : "no-value";
      if (entry.status === "filled") mark(fileTarget(field.el), "filled");
      continue;
    }
    const value = values[profileKey];
    if (!value) {
      entry.status = "no-value";
      if (field.required) mark(target, "attention");
      continue;
    }
    // Checkboxes are consent/acknowledgement boxes; those stay the user's call.
    if (field.kind === "checkbox") {
      entry.status = "unmatched";
      continue;
    }
    let ok = false;
    try {
      if (field.kind === "select") ok = fillSelect(field.el, value, profileKey);
      else if (field.kind === "radio") ok = fillRadio(field, value, profileKey);
      else if (field.kind === "combobox")
        ok = await fillCombobox(field.el, value, profileKey);
      else ok = fillText(field.el, value);
    } catch (e) {
      entry.error = String(e?.message || e);
    }
    entry.status = ok ? "filled" : "failed";
    mark(target, ok ? "filled" : "attention");
  }
  return report;
}

// Hidden upload inputs: outline the visible group instead.
function fileTarget(el) {
  return el.closest('[role="group"]') || el.parentElement || el;
}
