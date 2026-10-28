// Finds the fillable controls on a page and the human label for each one.

const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
const byIds = (doc, ids) =>
  (ids || "")
    .split(/\s+/)
    .map((id) => id && doc.getElementById(id))
    .filter(Boolean)
    .map(text)
    .join(" ");

// Lever and Ashby wrap each question in a container whose title is not tied
// to the control: Lever's custom questions and Ashby's radio groups and
// Yes/No buttons. A title that is a <label for> another control belongs to
// that control (Ashby's SMS consent radios sit under the Phone title).
const QUESTION = ".application-question, .ashby-application-form-field-entry";
const TITLE = ".application-label, .ashby-application-form-question-title";
export function questionTitle(el) {
  const doc = el.ownerDocument;
  const box = el.closest(`fieldset, ${QUESTION}`);
  const title = box?.querySelector(TITLE);
  if (!title) return "";
  const target = title.htmlFor && doc.getElementById(title.htmlFor);
  if (target && target !== el) return "";
  return text(title).replace(/\s*✱$/, "");
}

export function labelFor(el, { option = false } = {}) {
  const doc = el.ownerDocument;
  const labelled = byIds(doc, el.getAttribute("aria-labelledby"));
  if (labelled) return labelled;
  if (el.id) {
    const label = [...doc.querySelectorAll("label[for]")].find(
      (l) => l.htmlFor === el.id,
    );
    // Greenhouse's visually hidden "Attach" label says nothing; use the group.
    if (label && text(label) && !/^(attach|upload|browse)$/i.test(text(label)))
      return text(label);
  }
  // Lever's <label> also wraps the control, so its text would include a
  // select's options or a dropdown's "No location found"; prefer the title.
  const title = option ? "" : questionTitle(el);
  if (title) return title;
  const wrapping = el.closest("label");
  if (wrapping && text(wrapping)) return text(wrapping);
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
  const group = el.closest(
    '[role="group"][aria-labelledby], [role="radiogroup"][aria-labelledby]',
  );
  if (group) return byIds(doc, group.getAttribute("aria-labelledby"));
  const legend = el.closest("fieldset")?.querySelector("legend");
  if (legend && text(legend)) return text(legend);
  return el.getAttribute("placeholder") || el.getAttribute("title") || "";
}

function questionFor(el) {
  // Radios and checkboxes: the question is the group's legend, not one option.
  const doc = el.ownerDocument;
  const group = el.closest('[role="radiogroup"], [role="group"], fieldset');
  if (group) {
    const id = group.getAttribute("aria-labelledby");
    if (id) return byIds(doc, id);
    const legend = group.querySelector("legend");
    if (legend) return text(legend);
  }
  return questionTitle(el);
}

function visible(el) {
  if (el.type === "file") return true; // Upload inputs are usually hidden behind a button.
  if (el.disabled || el.readOnly) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  const style = el.ownerDocument.defaultView.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

const SKIP_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "password",
  "search",
]);

// Checkboxes that are options of one question ("select all that apply"):
// Lever gives them one name, Ashby one fieldset. A lone box is a consent box.
function checkboxGroup(el) {
  const box = el.closest("fieldset, ul, [role=group]");
  if (!box) return null;
  const peers = box.querySelectorAll('input[type="checkbox"]');
  return peers.length > 1 ? box : null;
}

// Ashby's Yes/No questions are two buttons (aria-pressed) over a hidden checkbox.
function buttonGroups(root, fields) {
  for (const box of root.querySelectorAll('[class*="yesno"]')) {
    const buttons = [...box.querySelectorAll("button")].filter(visible);
    if (buttons.length < 2) continue;
    fields.push({
      el: box,
      id: "",
      name: box.querySelector("input")?.getAttribute("name") || "",
      autocomplete: "",
      required: !!box.closest(QUESTION)?.querySelector('[class*="required"]'),
      kind: "buttons",
      label: questionTitle(box),
      options: buttons.map((b) => ({ el: b, label: text(b) })),
    });
  }
}

export function collectFields(root) {
  const fields = [];
  const radioGroups = new Map();
  const checkGroups = new Map();
  buttonGroups(root, fields);
  for (const el of root.querySelectorAll("input, textarea, select")) {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (SKIP_TYPES.has(type) || !visible(el)) continue;
    if (el.closest('[class*="yesno"]')) continue;
    const base = {
      el,
      id: el.id || "",
      name: el.getAttribute("name") || "",
      autocomplete: el.getAttribute("autocomplete") || "",
      required: el.required || el.getAttribute("aria-required") === "true",
    };
    if (type === "radio") {
      const key = el.name || questionFor(el);
      if (!radioGroups.has(key)) {
        const group = {
          ...base,
          kind: "radio",
          label: questionFor(el) || labelFor(el),
          options: [],
        };
        radioGroups.set(key, group);
        fields.push(group);
      }
      const group = radioGroups.get(key);
      group.options.push({ el, label: labelFor(el, { option: true }) });
      group.required ||= base.required;
      continue;
    }
    const box = type === "checkbox" && checkboxGroup(el);
    if (box) {
      if (!checkGroups.has(box)) {
        // Ashby names each box after its option ("Email"), which says
        // nothing about the question, so classify by the title alone.
        const group = {
          ...base,
          id: "",
          name: "",
          kind: "checkboxes",
          label: questionFor(el),
          options: [],
        };
        checkGroups.set(box, group);
        fields.push(group);
      }
      const group = checkGroups.get(box);
      group.options.push({ el, label: labelFor(el, { option: true }) });
      group.required ||= base.required;
      continue;
    }
    let kind = "text";
    if (el.tagName === "SELECT") kind = "select";
    else if (el.tagName === "TEXTAREA") kind = "textarea";
    else if (type === "file") kind = "file";
    else if (type === "checkbox") kind = "checkbox";
    else if (el.getAttribute("role") === "combobox") kind = "combobox";
    // Lever's location box: typed text only counts once a suggestion is picked.
    else if (el.classList.contains("location-input")) kind = "suggest";
    const label = kind === "file" ? fileLabel(el) : labelFor(el);
    fields.push({ ...base, kind, label });
  }
  // Page order, so button groups sit among the rest (entries depend on it).
  const FOLLOWING = 4; // Node.DOCUMENT_POSITION_FOLLOWING
  return fields.sort((a, b) =>
    a.el === b.el ? 0 : a.el.compareDocumentPosition(b.el) & FOLLOWING ? -1 : 1,
  );
}

function fileLabel(el) {
  const group = el.closest('[role="group"][aria-labelledby]');
  if (group)
    return byIds(el.ownerDocument, group.getAttribute("aria-labelledby"));
  return labelFor(el);
}
