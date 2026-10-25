import {
  loadSettings,
  saveSettings,
  checkUrl,
  fetchApplicant,
  fetchResumeFile,
  saveAnswers,
} from "./folio-api.js";
import { summarize } from "./summary.js";
import { ext, HOSTS, requestHosts } from "./ext.js";
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
    // Firefox may not have granted host access yet; that looks like Folio being down.
    const granted = await ext.permissions
      ?.contains({ origins: HOSTS })
      .catch(() => true);
    say(
      granted === false
        ? "Click Save and connect to allow access to Folio on this computer."
        : e.message,
      true,
    );
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
  const bank = data.answers?.length || 0;
  $("summary").textContent =
    `${count} profile answer${count === 1 ? "" : "s"}` +
    (bank ? ` and ${bank} saved from past forms` : "") +
    " ready.";
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
        const available =
          key === "resume"
            ? hasResumeFile
            : key === "startDate"
              ? !!saved.noticePeriod
              : key === "savedAnswers"
                ? !!data?.answers?.length
                : !!saved[key];
        note.textContent =
          key === "savedAnswers" && available
            ? `${data.answers.length} saved`
            : available
              ? ""
              : "not saved in Folio";
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
  // Ask before any await so Firefox still sees the click as the user's.
  const access = requestHosts();
  try {
    if (!(await access))
      throw new Error(
        "Folio Autofill needs access to Folio on this computer. Allow it to continue.",
      );
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
  const access = requestHosts();
  const button = $("fill");
  button.disabled = true;
  say("Filling…");
  try {
    const [tab] = await ext.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !/^https?:/.test(tab.url || "https:"))
      throw new Error("Open a job application page first.");
    if (!(await access))
      throw new Error("Allow Folio Autofill's site access to fill this page.");
    const fresh = await fetchApplicant(settings);
    const file = await fetchResumeFile(settings, fresh.applicant.resume);
    const target = { tabId: tab.id, allFrames: true };
    await ext.scripting.executeScript({ target, files: ["content.js"] });
    const results = await ext.scripting.executeScript({
      target,
      func: (applicant, file, options) =>
        globalThis.__folioAutofill?.(applicant, file, options),
      args: [
        fresh.applicant,
        disabled.has("resume") ? null : file,
        { off: [...disabled], answers: fresh.answers || [] },
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
          : e.status === "failed" || e.status === "check"
            ? "check"
            : "required",
      ),
    ),
    ...filled.map((e) =>
      row(e, "filled", e.key === "saved" ? "saved" : "filled"),
    ),
    ...skipped.map((e) =>
      row(e, "", { kept: "kept", off: "off" }[e.status] || "skipped"),
    ),
  );
}

// --- Saving answers from the page -------------------------------------------
let captured = [];
$("capture").addEventListener("click", async () => {
  const button = $("capture");
  button.disabled = true;
  say("Reading your answers…");
  try {
    const [tab] = await ext.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !/^https?:/.test(tab.url || "https:"))
      throw new Error("Open the application you answered first.");
    const target = { tabId: tab.id, allFrames: true };
    await ext.scripting.executeScript({ target, files: ["content.js"] });
    const frames = await ext.scripting.executeScript({
      target,
      func: () => globalThis.__folioCapture?.(),
    });
    const seen = new Set();
    captured = frames
      .flatMap((f) => f.result?.answers || [])
      .filter((a) => !seen.has(a.question) && seen.add(a.question))
      .map((a) => ({ ...a, include: true, detected: a.company }));
    const company = frames.map((f) => f.result?.company).find(Boolean) || "";
    captured.forEach((a) => (a.pageCompany = company));
    renderReview();
    say(captured.length ? "" : "No answers of yours to save on this page yet.");
  } catch (e) {
    say(e.message, true);
  } finally {
    button.disabled = false;
  }
});
function renderReview() {
  $("review").hidden = !captured.length;
  const chosen = captured.filter((a) => a.include).length;
  $("review-title").textContent =
    `${captured.length} answer${captured.length === 1 ? "" : "s"} found`;
  $("review-save").textContent = `Save ${chosen} to Folio`;
  $("review-save").disabled = !chosen;
  $("review-list").replaceChildren(
    ...captured.map((a) => {
      const li = document.createElement("li");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = a.include;
      box.setAttribute("aria-label", `Save answer to: ${a.question}`);
      box.addEventListener("change", () => {
        a.include = box.checked;
        renderReview();
      });
      const q = document.createElement("span");
      q.className = "q";
      q.textContent = a.question;
      const ans = document.createElement("span");
      ans.className = "a";
      ans.textContent =
        a.kind === "draft"
          ? `${a.answer.slice(0, 90)}… (saved as a draft, never autofilled)`
          : a.answer;
      li.append(box, q, ans);
      if (a.pageCompany) {
        const scope = document.createElement("label");
        scope.className = "scope";
        const only = document.createElement("input");
        only.type = "checkbox";
        only.checked = !!a.company;
        only.addEventListener("change", () => {
          a.company = only.checked ? a.pageCompany : "";
        });
        scope.append(only, ` Only for ${a.pageCompany}`);
        li.append(scope);
      }
      return li;
    }),
  );
}
$("review-cancel").addEventListener("click", () => {
  captured = [];
  renderReview();
});
$("review-save").addEventListener("click", async () => {
  const button = $("review-save");
  button.disabled = true;
  try {
    const answers = captured
      .filter((a) => a.include)
      .map(({ question, answer, kind, company }) => ({
        question,
        answer,
        kind,
        company,
      }));
    const result = await saveAnswers(settings, answers);
    captured = [];
    renderReview();
    await connect();
    say(
      `Saved to Folio: ${result.added} new, ${result.updated} updated (${result.total} in total).`,
    );
  } catch (e) {
    say(e.message, true);
    button.disabled = false;
  }
});

Promise.all([loadSettings(), loadDisabled()]).then(([loaded, off]) => {
  settings = loaded;
  disabled = off;
  $("folio-url").value = settings.folioUrl;
  $("pairing-key").value = settings.pairingKey;
  connect();
});
