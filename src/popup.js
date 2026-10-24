import {
  loadSettings,
  saveSettings,
  checkUrl,
  fetchApplicant,
  fetchResumeFile,
} from "./folio-api.js";
import { summarize } from "./summary.js";

const $ = (id) => document.getElementById(id);
let settings, data;

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
      func: (applicant, file) => globalThis.__folioAutofill?.(applicant, file),
      args: [fresh.applicant, file],
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
    ...skipped.map((e) => row(e, "", e.status === "kept" ? "kept" : "skipped")),
  );
}

loadSettings().then((loaded) => {
  settings = loaded;
  $("folio-url").value = settings.folioUrl;
  $("pairing-key").value = settings.pairingKey;
  connect();
});
