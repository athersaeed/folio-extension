// Writes values into form controls so that React/Vue-managed forms register them.
import { matchOption } from "../options.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Events are built from the page's own window (matters in frames and in tests).
const fire = (el, type, Ctor = el.ownerDocument.defaultView.Event, init = {}) =>
  el.dispatchEvent(
    new Ctor(type, { bubbles: true, cancelable: true, ...init }),
  );
const key = (el, type, k) =>
  fire(el, type, el.ownerDocument.defaultView.KeyboardEvent, {
    key: k,
    code: k,
  });
const mouse = (el, type) =>
  fire(el, type, el.ownerDocument.defaultView.MouseEvent, { button: 0 });

// Frameworks track the last value they saw on the element itself; calling the
// prototype setter bypasses that tracker so the following input event registers.
function setNativeValue(el, value) {
  const view = el.ownerDocument.defaultView;
  const proto =
    el.tagName === "TEXTAREA"
      ? view.HTMLTextAreaElement.prototype
      : el.tagName === "SELECT"
        ? view.HTMLSelectElement.prototype
        : view.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
}

const pressed = (b) => b.getAttribute("aria-pressed") === "true";

export function hasValue(field) {
  const { el, kind } = field;
  if (kind === "radio" || kind === "checkboxes")
    return field.options.some((o) => o.el.checked);
  if (kind === "buttons") return field.options.some((o) => pressed(o.el));
  if (kind === "checkbox") return el.checked;
  if (kind === "file") return el.files?.length > 0;
  if (kind === "select") return el.selectedIndex > 0 && !!el.value;
  // Ashby's autocomplete keeps the picked value in the input itself.
  if (kind === "combobox") return !!comboboxValue(el) || !!el.value.trim();
  return !!el.value.trim();
}

// What the user has entered, as text: typed value, chosen option or radio label.
export function readValue(field) {
  const { el, kind } = field;
  if (kind === "radio")
    return field.options.find((o) => o.el.checked)?.label || "";
  if (kind === "checkboxes")
    return field.options
      .filter((o) => o.el.checked)
      .map((o) => o.label)
      .join(", ");
  if (kind === "buttons")
    return field.options.find((o) => pressed(o.el))?.label || "";
  if (kind === "select")
    return el.value ? el.selectedOptions[0]?.textContent.trim() || "" : "";
  if (kind === "combobox") return comboboxValue(el) || el.value || "";
  return el.value || "";
}

export function fillText(el, value) {
  el.focus();
  setNativeValue(el, value);
  fire(el, "input");
  fire(el, "change");
  el.blur();
  // Masked inputs (phone, dates) reformat as they go; same characters means it stuck.
  const bare = (v) => v.replace(/[^\p{L}\p{N}]/gu, "");
  const got = bare(el.value),
    want = bare(value);
  // endsWith tolerates an added country code such as +1.
  return (
    el.value === value || (!!got && (got.endsWith(want) || want.endsWith(got)))
  );
}

// `pick(optionTexts) → index` chooses the option; by default it compares the
// saved answer's wording, start dates pass a notice-period matcher instead.
const byWording = (value, profileKey) => (texts) =>
  matchOption(texts, value, profileKey);

export function fillSelect(
  el,
  value,
  profileKey,
  pick = byWording(value, profileKey),
) {
  const options = [...el.options];
  const i = pick(options.map((o) => o.textContent));
  if (i < 0) return false;
  setNativeValue(el, options[i].value);
  fire(el, "input");
  fire(el, "change");
  return el.selectedIndex === i;
}

export function fillRadio(
  field,
  value,
  profileKey,
  pick = byWording(value, profileKey),
) {
  const i = pick(field.options.map((o) => o.label));
  if (i < 0) return false;
  const input = field.options[i].el;
  input.click();
  if (!input.checked) {
    input.checked = true;
    fire(input, "change");
  }
  return input.checked;
}

// "Select all that apply" lists: ticks the one option that means the answer.
export function fillCheckboxes(
  field,
  value,
  profileKey,
  pick = byWording(value, profileKey),
) {
  const i = pick(field.options.map((o) => o.label));
  if (i < 0) return false;
  const input = field.options[i].el;
  input.click();
  return input.checked;
}

// Ashby's Yes/No buttons.
export async function fillButtons(
  field,
  value,
  profileKey,
  pick = byWording(value, profileKey),
) {
  const i = pick(field.options.map((o) => o.label));
  if (i < 0) return false;
  const button = field.options[i].el;
  button.click();
  await sleep(50);
  return pressed(button);
}

// Lever's location box: type, wait for its suggestions, pick one. Leaving the
// box with only typed text makes Lever clear it, so a miss empties it here.
export async function fillSuggest(
  el,
  value,
  profileKey,
  pick = byWording(value, profileKey),
) {
  const scope = el.closest(".application-field") || el.parentElement;
  const results = () => [
    ...scope.querySelectorAll('.dropdown-location, [role="option"]'),
  ];
  el.focus();
  setNativeValue(el, value);
  fire(el, "input");
  key(el, "keydown", "a");
  key(el, "keyup", "a");
  let options = [];
  for (let t = 0; t < 4000 && !options.length; t += 100) {
    await sleep(100);
    options = results();
  }
  const i = pick(options.map((o) => o.textContent));
  if (i < 0) {
    setNativeValue(el, "");
    fire(el, "input");
    el.blur();
    return false;
  }
  mouse(options[i], "mousedown");
  mouse(options[i], "mouseup");
  mouse(options[i], "click");
  await sleep(50);
  el.blur();
  return !!el.value.trim();
}

// --- react-select style comboboxes (Greenhouse, Ashby, Lever) ---------------
const ROOT =
  '.select-shell, [class*="container"]:not([class*="input-container"]):not([class*="value-container"]):not([class*="indicators"])';
function comboboxRoot(el) {
  for (
    let node = el.parentElement, i = 0;
    node && i < 8;
    node = node.parentElement, i++
  )
    if (node.matches(ROOT)) return node;
  return el.parentElement;
}
// Single selects show one value; multi selects (pronouns) show a chip per pick.
function comboboxValue(el) {
  const root = comboboxRoot(el);
  const single = root?.querySelector(
    '[class*="single-value"], [class*="singleValue"]',
  );
  if (single) return single.textContent.trim();
  const chips = root?.querySelectorAll(
    '[class*="multi-value__label"], [class*="multiValueLabel"]',
  );
  return [...(chips || [])]
    .map((c) => c.textContent.trim())
    .filter(Boolean)
    .join(", ");
}
function listOptions(el) {
  const doc = el.ownerDocument;
  const owned =
    el.getAttribute("aria-controls") || el.getAttribute("aria-owns");
  let scope = owned && doc.getElementById(owned);
  if (!scope) {
    // react-select names options after its instance id; otherwise look nearby.
    const prefix = `react-select-${el.id}-option`;
    const byId = [...doc.querySelectorAll('[id^="react-select-"]')].filter(
      (o) => o.id.startsWith(prefix),
    );
    if (byId.length) return byId;
    scope = comboboxRoot(el);
  }
  const options = [...(scope?.querySelectorAll('[role="option"]') || [])];
  if (options.length || owned) return options;
  // Popups rendered at the end of <body> (Ashby): use the one open listbox.
  const open = [...doc.querySelectorAll('[role="listbox"]')].filter((l) =>
    l.querySelector('[role="option"]'),
  );
  return open.length === 1
    ? [...open[0].querySelectorAll('[role="option"]')]
    : [];
}
async function waitForOptions(el, ms = 1500) {
  for (let t = 0; t < ms; t += 50) {
    const options = listOptions(el);
    if (options.length) return options;
    await sleep(50);
  }
  return [];
}
async function openCombobox(el) {
  el.focus();
  // Greenhouse opens its menu on keyup / mouseup, not on react-select's own
  // mousedown, so send the full sequences and stop as soon as options appear.
  key(el, "keydown", "ArrowDown");
  key(el, "keyup", "ArrowDown");
  let options = await waitForOptions(el, 300);
  if (options.length) return options;
  const control = el.closest('[class*="control"]') || el;
  mouse(control, "mousedown");
  mouse(control, "mouseup");
  mouse(control, "click");
  return waitForOptions(el, 500);
}
export async function fillCombobox(
  el,
  value,
  profileKey,
  pick = byWording(value, profileKey),
) {
  let options = await openCombobox(el);
  // Async lists (locations) only load after typing.
  if (!options.length || pick(options.map((o) => o.textContent)) < 0) {
    setNativeValue(el, value);
    fire(el, "input");
    key(el, "keyup", "a");
    await sleep(400);
    options = await waitForOptions(el, 2500);
  }
  const i = pick(options.map((o) => o.textContent));
  if (i < 0) {
    key(el, "keydown", "Escape");
    key(el, "keyup", "Escape");
    if (el.value) {
      setNativeValue(el, "");
      fire(el, "input");
    }
    el.blur();
    return false;
  }
  mouse(options[i], "mousedown");
  mouse(options[i], "mouseup");
  mouse(options[i], "click");
  await sleep(100);
  el.blur();
  return !!comboboxValue(el) || el.value === options[i].textContent.trim();
}

export function attachFile(el, file) {
  const view = el.ownerDocument.defaultView;
  const transfer = new view.DataTransfer();
  transfer.items.add(
    new view.File([file.bytes], file.name, { type: file.type }),
  );
  el.files = transfer.files;
  fire(el, "input");
  fire(el, "change");
  return el.files.length === 1;
}
