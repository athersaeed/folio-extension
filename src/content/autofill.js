// One autofill pass over a document: detect fields, match them to profile keys,
// fill what the user has saved answers for, and report everything else.
// Never submits, never overwrites a field that already has a value.
import { classify } from "../classify.js";
import { collectFields } from "./fields.js";
import { startPlan, dateForTextField, matchNotice } from "../start-date.js";
import { findSavedAnswer, detectCompany } from "../answers.js";
import { assignEntries, entryValue } from "../entries.js";
import { countryNamed, sameCountry } from "../options.js";
import {
  hasValue,
  fillText,
  fillSelect,
  fillRadio,
  fillCombobox,
  fillButtons,
  fillCheckboxes,
  fillSuggest,
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
  const SECTIONS = ["education", "experience"];
  const wanted = Object.fromEntries(
    SECTIONS.map((s) => [s, disabled.has(s) ? 0 : applicant[s]?.length || 0]),
  );
  const bad = new Set(); // "section:index" entries with a field that failed
  const added = { education: 0, experience: 0 };
  // Answers can reveal follow-up questions (race appears after "Hispanic or
  // Latino? No"), and "Add another" adds a resume entry, so look again for
  // fields that showed up during the pass.
  const seen = new Set();
  const passes = 3 + wanted.education + wanted.experience;
  for (let pass = 0; pass < passes; pass++) {
    if (pass) await sleep(150);
    const all = collectFields(doc);
    const { entries } = assignEntries(all);
    const fresh = all.filter((f) => !seen.has(f.el));
    if (!fresh.length) break;
    for (const field of fresh) {
      seen.add(field.el);
      const slot = entries.get(field);
      if (slot) await fillEntryField(field, slot);
      else await fillField(field);
    }
    for (const section of SECTIONS) addEntry(section);
  }
  return report;

  // Clicks the section's "Add another" when the resume has more entries than
  // the form shows, but only after every earlier entry filled cleanly, at most
  // once per pass, and never more than the resume needs.
  function addEntry(section) {
    const all = collectFields(doc);
    const { entries, count } = assignEntries(all);
    const have = count[section];
    if (
      !have ||
      have >= wanted[section] ||
      added[section] >= wanted[section] - 1
    )
      return;
    for (let i = 0; i < have; i++) if (bad.has(`${section}:${i}`)) return;
    const last = all.filter((f) => entries.get(f)?.section === section).pop();
    const button = addButtonAfter(last.el);
    if (!button) return;
    button.click();
    added[section]++;
  }

  async function fillEntryField(field, slot) {
    const { section, index, key } = slot;
    const entry = {
      label: `${field.label.slice(0, 100) || key} (${section} ${index + 1})`,
      key: `${section}.${key}`,
      kind: field.kind,
      required: field.required,
    };
    report.push(entry);
    const target = targetOf(field);
    const fail = () => bad.add(`${section}:${index}`);
    if (disabled.has(section)) {
      entry.status = "off";
      return;
    }
    const value = entryValue(applicant, slot);
    if (key === "current") {
      // Only ever ticks the box for a role the resume says is ongoing.
      if (field.kind !== "checkbox" || !value || field.el.checked) {
        entry.status = field.el.checked ? "kept" : "no-value";
        return;
      }
      field.el.click();
      entry.status = field.el.checked ? "filled" : "failed";
      if (!field.el.checked) fail();
      mark(target, field.el.checked ? "filled" : "attention");
      return;
    }
    if (hasValue(field)) {
      entry.status = "kept";
      return;
    }
    if (!value) {
      entry.status = "no-value";
      if (field.required) mark(target, "attention");
      return;
    }
    let ok = false;
    try {
      if (field.kind === "select") ok = fillSelect(field.el, value, key);
      else if (field.kind === "radio") ok = fillRadio(field, value, key);
      else if (field.kind === "combobox")
        ok = await fillCombobox(field.el, value, key);
      else if (field.kind === "buttons")
        ok = await fillButtons(field, value, key);
      else if (field.kind === "checkbox" || field.kind === "checkboxes")
        ok = false;
      else ok = fillText(field.el, textForEntry(key, value));
    } catch (e) {
      entry.error = String(e?.message || e);
    }
    entry.status = ok ? "filled" : "failed";
    if (!ok) fail();
    mark(target, ok ? "filled" : "attention");
  }

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
    const target = targetOf(field);
    // Not a profile question: try the answers the user saved from past forms.
    const saved =
      !profileKey &&
      bank.length &&
      !["checkbox", "checkboxes", "file"].includes(field.kind) &&
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
    // Eligibility answers hold for one country; a question about another
    // country ("authorized to work in the US?") is the user's to answer.
    if (
      profileKey === "workAuthorized" ||
      profileKey === "requiresSponsorship"
    ) {
      const asked = countryNamed(field.label);
      if (
        asked &&
        !(values.workCountry && sameCountry(asked, values.workCountry))
      ) {
        entry.status = "no-value";
        entry.note = `asks about ${asked}`;
        mark(target, "attention");
        return;
      }
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
      else if (field.kind === "checkboxes")
        ok = fillCheckboxes(field, value, profileKey);
      else if (field.kind === "buttons")
        ok = await fillButtons(field, value, profileKey);
      else if (field.kind === "combobox")
        ok = await fillCombobox(field.el, value, profileKey);
      else if (field.kind === "suggest")
        ok = await fillSuggest(field.el, value, profileKey);
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
  if (kind === "buttons")
    return fillButtons(field, plan.notice, "startDate", pick);
  if (kind === "checkboxes")
    return fillCheckboxes(field, plan.notice, "startDate", pick);
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
  if (kind === "buttons") return fillButtons(field, text, "");
  if (kind === "combobox") return fillCombobox(el, text, "");
  if (kind === "suggest") return fillSuggest(el, text, "");
  return fillText(el, text);
}

function targetOf(field) {
  if (field.kind === "radio" || field.kind === "checkboxes")
    return (
      field.options[0].el.closest("fieldset, [role=radiogroup], ul") ||
      field.options[0].el
    );
  if (field.kind === "combobox")
    return field.el.closest('[class*="control"]') || field.el;
  return field.el;
}

// Typed month boxes get "09" rather than "September".
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
function textForEntry(key, value) {
  if (key !== "startMonth" && key !== "endMonth") return value;
  return String(MONTHS.indexOf(value) + 1).padStart(2, "0");
}

// The first "Add another" style control after the section's last field.
const ADD =
  /^\+?\s*add (another|more|education|employment|experience|school|position|job|role)\b/i;
function addButtonAfter(el) {
  const doc = el.ownerDocument;
  const after = el.ownerDocument.defaultView.Node.DOCUMENT_POSITION_FOLLOWING;
  return [...doc.querySelectorAll("button, a, [role=button]")].find(
    (b) =>
      ADD.test(b.textContent.replace(/\s+/g, " ").trim()) &&
      el.compareDocumentPosition(b) & after,
  );
}

// Hidden upload inputs: outline the visible group instead.
function fileTarget(el) {
  return el.closest('[role="group"]') || el.parentElement || el;
}
