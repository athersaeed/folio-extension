import {
  loadSettings,
  saveSettings,
  checkUrl,
  fetchApplicant,
  fetchResumeFile,
} from "./folio-api.js";
import { summarize } from "./summary.js";
import {
  OPTION_GROUPS,
  loadDisabled,
  saveDisabled,
} from "./autofill-options.js";

const $ = (id) => document.getElementById(id);
let settings,
  data,
  disabled = new Set();

function say(text, isError = false) {
  $("message").textContent = text;
  $("message").className = isError ? "error" : "";
}
function showSettings(open) {
  $("settings").hidden = !open;
  $("settings-toggle").setAttribute("aria-expanded", String(open));
}

async function connect() {
  $("main").hidden = true;
  if (!settings.pairingKey) {
    showSettings(true);
    say("Pair with Folio to start.");
    return;
  }
  try {
    data = await fetchApplicant(settings);
  } catch (e) {
    showSettings(true);
    say(e.message, true);
    return;
  }
  say("");
  showSettings(false);
  const select = $("resume");
  select.replaceChildren(
    ...data.resumes.map(
      (r) => new Option(r.original ? r.name : `${r.name} (no file)`, r.id),
    ),
  );
  if (!data.resumes.length) {
    say("No reviewed resumes in Folio yet. Review and save one first.", true);
    return;
  }
  select.value = data.applicant.resume?.id || data.resumes[0].id;
  const count = Object.keys(data.applicant.fields).length;
  $("summary").textContent =
    `${count} saved answer${count === 1 ? "" : "s"} ready.`;
  $("main").hidden = false;
  renderOptions();
}

// --- Options tab -------------------------------------------------------------
function showTab(name) {
  for (const tab of ["fill", "options"]) {
    $(`tab-${tab}`).setAttribute("aria-selected", String(tab === name));
    $(`panel-${tab}`).hidden = tab !== name;
  }
  $("results").hidden = name !== "fill" || !$("results-list").children.length;
}
$("tab-fill").addEventListener("click", () => showTab("fill"));
$("tab-options").addEventListener("click", () => showTab("options"));

function renderOptions() {
  const saved = data?.applicant.fields || {};
  const hasResumeFile = !!data?.applicant.resume?.original;
  $("options-list").replaceChildren(
    ...OPTION_GROUPS.map((group) => {
      const set = document.createElement("fieldset");
      set.className = "option-group";
      const legend = document.createElement("legend");
      legend.append(group.title);
      const allOn = group.fields.every(([key]) => !disabled.has(key));
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "link";
      toggle.textContent = allOn ? "Turn all off" : "Turn all on";
      toggle.addEventListener("click", () =>
        update(
          group.fields.map(([key]) => key),
          !allOn,
        ),
      );
      legend.append(toggle);
      set.append(legend);
      for (const [key, label] of group.fields) {
        const row = document.createElement("label");
        row.className = "option";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = !disabled.has(key);
        box.addEventListener("change", () => update([key], box.checked));
        const note = document.createElement("span");
        note.className = "note";
        const available = key === "resume" ? hasResumeFile : !!saved[key];
        note.textContent = available ? "" : "not saved in Folio";
        row.append(box, label, note);
        set.append(row);
      }
      return set;
    }),
  );
}
async function update(keys, on) {
  for (const key of keys) on ? disabled.delete(key) : disabled.add(key);
  await saveDisabled(disabled);
  renderOptions();
}

$("settings-toggle").addEventListener("click", () =>
  showSettings($("settings").hidden),
);
$("settings").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const folioUrl = checkUrl(
      $("folio-url").value || $("folio-url").placeholder,
    );
    const pairingKey = $("pairing-key").value.trim();
    if (!/^[a-f0-9]{48}$/.test(pairingKey))
      throw new Error("That does not look like a Folio pairing key.");
    settings = { ...settings, folioUrl, pairingKey };
    await saveSettings({ folioUrl, pairingKey });
    await connect();
  } catch (e) {
    say(e.message, true);
  }
});
$("resume").addEventListener("change", async () => {
  settings.resumeId = $("resume").value;
  await saveSettings({ resumeId: settings.resumeId });
  await connect();
});

$("fill").addEventListener("click", async () => {
  const button = $("fill");
  button.disabled = true;
  say("Filling…");
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !/^https?:/.test(tab.url || "https:"))
      throw new Error("Open a job application page first.");
    const fresh = await fetchApplicant(settings);
    const file = await fetchResumeFile(settings, fresh.applicant.resume);
    const target = { tabId: tab.id, allFrames: true };
    await chrome.scripting.executeScript({ target, files: ["content.js"] });
    const results = await chrome.scripting.executeScript({
      target,
      func: (applicant, file, options) =>
        globalThis.__folioAutofill?.(applicant, file, options),
      args: [
        fresh.applicant,
        disabled.has("resume") ? null : file,
        { off: [...disabled] },
      ],
    });
    render(summarize(results.map((r) => r.result).filter(Boolean)));
    say("");
  } catch (e) {
    say(e.message, true);
  } finally {
    button.disabled = false;
  }
});

function render({ filled, attention, skipped }) {
  $("results").hidden = false;
  $("results-title").textContent = attention.length
    ? `Filled ${filled.length}. ${attention.length} need you.`
    : filled.length
      ? `Filled ${filled.length}. Review, then submit.`
      : "Nothing to fill on this page.";
  const row = (entry, cls, tag) => {
    const li = document.createElement("li");
    li.className = cls;
    const t = document.createElement("span");
    t.className = "tag";
    t.textContent = tag;
    const label = document.createElement("span");
    label.textContent = entry.label;
    li.append(t, label);
    return li;
  };
  $("results-list").replaceChildren(
    ...attention.map((e) =>
      row(
        e,
        "attention",
        e.status === "no-value"
          ? "no answer"
          : e.status === "failed"
            ? "check"
            : "required",
      ),
    ),
    ...filled.map((e) => row(e, "filled", "filled")),
    ...skipped.map((e) =>
      row(e, "", { kept: "kept", off: "off" }[e.status] || "skipped"),
    ),
  );
}

Promise.all([loadSettings(), loadDisabled()]).then(([loaded, off]) => {
  settings = loaded;
  disabled = off;
  $("folio-url").value = settings.folioUrl;
  $("pairing-key").value = settings.pairingKey;
  connect();
});
