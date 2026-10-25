// One autofill pass over a document: detect fields, match them to profile keys,
// fill what the user has saved answers for, and report everything else.
// Never submits, never overwrites a field that already has a value.
import { classify } from "../classify.js";
import { collectFields } from "./fields.js";
import { startPlan, dateForTextField, matchNotice } from "../start-date.js";
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
  // !important: react-select styles its control with outline: 0 !important.
  const color = status === "filled" ? "#5f9c58" : "#d39b38";
  el.style.setProperty("outline", `2px solid ${color}`, "important");
  el.style.setProperty("outline-offset", "1px", "important");
}

export async function autofill(doc, applicant, file, { off = [] } = {}) {
  const disabled = new Set(off);
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
    // Switched off in the popup's Options tab: leave it, and don't nag.
    if (disabled.has(profileKey)) {
      entry.status = "off";
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
    // Start dates are worked out from the notice period at fill time.
    const plan = profileKey === "startDate" ? startPlan(values) : null;
    const value =
      profileKey === "startDate" ? plan?.notice : values[profileKey];
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
      if (plan) ok = await fillStartDate(field, plan);
      else if (field.kind === "select")
        ok = fillSelect(field.el, value, profileKey);
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

// Dropdowns pick by notice length; date inputs get the date; text boxes get a
// bare date when they spell out a format, otherwise a readable sentence.
async function fillStartDate(field, plan) {
  const pick = (texts) => matchNotice(texts, plan);
  const { el, kind } = field;
  if (kind === "select") return fillSelect(el, plan.notice, "startDate", pick);
  if (kind === "radio") return fillRadio(field, plan.notice, "startDate", pick);
  if (kind === "combobox")
    return fillCombobox(el, plan.notice, "startDate", pick);
  if (el.type === "date") return fillText(el, plan.iso);
  const hint = `${el.getAttribute("placeholder") || ""} ${field.label}`;
  return fillText(el, dateForTextField(plan, hint) ?? plan.text);
}

// Hidden upload inputs: outline the visible group instead.
function fileTarget(el) {
  return el.closest('[role="group"]') || el.parentElement || el;
}
