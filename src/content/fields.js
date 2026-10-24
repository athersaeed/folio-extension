// Finds the fillable controls on a page and the human label for each one.

const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
const byIds = (doc, ids) =>
  (ids || "")
    .split(/\s+/)
    .map((id) => id && doc.getElementById(id))
    .filter(Boolean)
    .map(text)
    .join(" ");

export function labelFor(el) {
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
  return "";
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

export function collectFields(root) {
  const fields = [];
  const radioGroups = new Map();
  for (const el of root.querySelectorAll("input, textarea, select")) {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (SKIP_TYPES.has(type) || !visible(el)) continue;
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
      group.options.push({ el, label: labelFor(el) });
      group.required ||= base.required;
      continue;
    }
    let kind = "text";
    if (el.tagName === "SELECT") kind = "select";
    else if (el.tagName === "TEXTAREA") kind = "textarea";
    else if (type === "file") kind = "file";
    else if (type === "checkbox") kind = "checkbox";
    else if (el.getAttribute("role") === "combobox") kind = "combobox";
    const label = kind === "file" ? fileLabel(el) : labelFor(el);
    fields.push({ ...base, kind, label });
  }
  return fields;
}

function fileLabel(el) {
  const group = el.closest('[role="group"][aria-labelledby]');
  if (group)
    return byIds(el.ownerDocument, group.getAttribute("aria-labelledby"));
  return labelFor(el);
}
