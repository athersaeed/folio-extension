// One autofill pass over a document: detect fields, match them to profile keys,
// fill what the user has saved answers for, and report everything else.
// Never submits, never overwrites a field that already has a value.
import { classify } from "../classify.js";
import { collectFields } from "./fields.js";
import { startPlan, dateForTextField, matchNotice } from "../start-date.js";
import { findSavedAnswer, detectCompany } from "../answers.js";
import {
  hasValue,
  fillText,
  fillSelect,
  fillRadio,
  fillCombobox,
  attachFile,
} from "./fill.js";

const MARK = "data-folio-autofill";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mark(el, status) {
  el.setAttribute(MARK, status);
  // !important: react-select styles its control with outline: 0 !important.
  const color = status === "filled" ? "#5f9c58" : "#d39b38";
  el.style.setProperty("outline", `2px solid ${color}`, "important");
  el.style.setProperty("outline-offset", "1px", "important");
}

export async function autofill(
  doc,
  applicant,
  file,
  { off = [], answers = [] } = {},
) {
  const disabled = new Set(off);
  const bank = disabled.has("savedAnswers") ? [] : answers;
  const company = bank.length ? detectCompany(doc) : "";
  const report = [];
  const values = applicant.fields || {};
  // Answers can reveal follow-up questions (race appears after "Hispanic or
  // Latino? No"), so look again for fields that showed up during the pass.
  const seen = new Set();
  for (let pass = 0; pass < 3; pass++) {
    if (pass) await sleep(150);
    const fresh = collectFields(doc).filter((f) => !seen.has(f.el));
    if (!fresh.length) break;
    for (const field of fresh) {
      seen.add(field.el);
      await fillField(field);
    }
  }
  return report;

  async function fillField(field) {
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
    // Not a profile question: try the answers the user saved from past forms.
    const saved =
      !profileKey &&
      bank.length &&
      field.kind !== "checkbox" &&
      field.kind !== "file" &&
      !hasValue(field)
        ? findSavedAnswer(bank, field.label, company)
        : null;
    if (saved) {
      entry.key = "saved";
      let ok = false;
      try {
        ok = await fillSaved(field, saved.answer.answer);
      } catch (e) {
        entry.error = String(e?.message || e);
      }
      // Similar but not identical wording: filled, but the user must check it.
      entry.status = !ok ? "failed" : saved.exact ? "filled" : "check";
      entry.savedQuestion = saved.answer.question;
      mark(target, entry.status === "filled" ? "filled" : "attention");
      return;
    }
    if (!profileKey) {
      entry.status = "unmatched";
      if (field.required && !hasValue(field)) mark(target, "attention");
      return;
    }
    // Switched off in the popup's Options tab: leave it, and don't nag.
    if (disabled.has(profileKey)) {
      entry.status = "off";
      return;
    }
    if (hasValue(field)) {
      entry.status = "kept";
      return;
    }
    if (profileKey === "resume") {
      entry.status = file
        ? attachFile(field.el, file)
          ? "filled"
          : "failed"
        : "no-value";
      if (entry.status === "filled") mark(fileTarget(field.el), "filled");
      return;
    }
    // Start dates are worked out from the notice period at fill time.
    const plan = profileKey === "startDate" ? startPlan(values) : null;
    const value =
      profileKey === "startDate" ? plan?.notice : values[profileKey];
    if (!value) {
      entry.status = "no-value";
      if (field.required) mark(target, "attention");
      return;
    }
    // Checkboxes are consent/acknowledgement boxes; those stay the user's call.
    if (field.kind === "checkbox") {
      entry.status = "unmatched";
      return;
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

function fillSaved(field, text) {
  const { el, kind } = field;
  if (kind === "select") return fillSelect(el, text, "");
  if (kind === "radio") return fillRadio(field, text, "");
  if (kind === "combobox") return fillCombobox(el, text, "");
  return fillText(el, text);
}

// Hidden upload inputs: outline the visible group instead.
function fileTarget(el) {
  return el.closest('[role="group"]') || el.parentElement || el;
}
