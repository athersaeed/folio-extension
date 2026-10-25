// Reads the questions the user answered themselves on this page, so the popup can
// offer them for the answer bank. Nothing is saved from here: the popup shows the
// list and only sends what the user approves.
import { classify } from "../classify.js";
import { collectFields } from "./fields.js";
import { readValue } from "./fill.js";
import { detectCompany } from "../answers.js";

// Never offer to store these, whatever the user typed.
const SENSITIVE =
  /\b(password|passcode|social security|ssn|sin number|national (id|insurance)|passport|date of birth|birth ?date|bank|routing|credit card|account number|tax id)\b/i;

const ABOUT_EMPLOYER =
  /\b(this|our) (company|organi[sz]ation|team|role|position|job|opening)\b|\bwork (here|for us|with us)\b|\b(applied|interviewed|worked) (here|with us|for us|to us)\b|\bjoin (us|our)\b/i;

export function captureAnswers(doc) {
  const company = detectCompany(doc);
  const answers = [];
  const seen = new Set();
  for (const field of collectFields(doc)) {
    // Files, consent boxes and profile questions (name, email, …) are not
    // answer-bank material; the profile already covers the latter.
    if (field.kind === "file" || field.kind === "checkbox") continue;
    if (classify(field)) continue;
    const question = field.label.replace(/\s*\*\s*$/, "").trim();
    if (question.length < 3 || SENSITIVE.test(question)) continue;
    const answer = readValue(field).trim();
    if (!answer) continue;
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const choice = ["select", "radio", "combobox"].includes(field.kind);
    const kind = choice
      ? "choice"
      : answer.length > 200 || (field.kind === "textarea" && answer.length > 80)
        ? "draft"
        : "text";
    // Essays, and questions that name or point at the employer, only make sense
    // for that company.
    const mentionsCompany =
      company &&
      (question.toLowerCase().includes(company.toLowerCase()) ||
        ABOUT_EMPLOYER.test(question));
    answers.push({
      question,
      answer,
      kind,
      company: kind === "draft" || mentionsCompany ? company : "",
    });
  }
  return { company, answers };
}
