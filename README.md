# Folio Autofill (browser extension)

Fills job applications from your local Folio workspace when you click **Fill this
page**. It reads your saved profile answers and a reviewed resume from the Folio
server on your computer, fills **empty** fields only, outlines what it filled
(green) and what still needs you (amber), and **never submits**.

## Set up

1. Start Folio (`folio parser llm`): `npm run dev`. Note the address, e.g.
   `http://127.0.0.1:5173`.
2. Build the extension:

   ```bash
   npm install
   npm run build
   ```

3. In Chrome, open `chrome://extensions`, turn on Developer mode, click **Load
   unpacked**, and pick this folder's `dist/`. (Firefox: see below.)
4. In Folio, open **Personal profile**, fill in your answers, save, then click
   **Show pairing key** under _Browser extension_.
5. Click the extension icon → Settings, paste the Folio address and the key.

## Firefox

The same code builds as a Firefox add-on in `dist-firefox/` (Firefox 140+), with
a Gecko ID and no Chrome-only manifest keys.

- **Try it:** `npm run firefox` opens a separate Firefox profile with the add-on
  loaded and Folio at `http://127.0.0.1:5174`. Or in your own Firefox, open
  `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick
  `dist-firefox/manifest.json`. Temporary add-ons are removed when Firefox
  restarts.
- **Keep it installed:** Firefox only installs signed add-ons permanently.
  `npm run package:firefox` builds a zip in `web-ext-artifacts/`; sign it as an
  unlisted add-on on addons.mozilla.org (free, not published) and install the
  signed `.xpi`.
- **Site access:** Firefox lets you withhold an add-on's site access. The popup
  asks for access to Folio and Greenhouse when you click **Save and connect** or
  **Fill this page**; allow it once.
- `npm run lint:firefox` runs Mozilla's add-on linter.

## Choosing what gets filled

The popup's **Options** tab lists every kind of field the extension can fill,
grouped like Folio's profile (contact, links, resume upload, eligibility,
preferences, voluntary self-identification). Everything starts on. Switch a field
or a whole group off and the extension leaves those questions for you: they are
reported as "off" and never flagged as missing. Fields without a saved answer in
Folio are marked "not saved in Folio". The choice is stored in the extension
(`chrome.storage.local`), so it applies to every job page.

## Saved answers (the answer bank)

After answering a form yourself, click **Save answers from this page**. The
popup lists the questions you answered that aren't profile questions (name,
email and so on are skipped, as are consent boxes, uploads and anything that
looks like an ID, password or bank detail). Untick what you don't want reused,
then **Save to Folio**. Answers are stored in your Folio data folder
(`workspace.json` → `answers`), and you can edit or delete them on Folio's
**Saved answers** page.

- Same question next time (ignoring case, punctuation and the `*`): filled.
- Similar wording (≥75% word overlap): filled but outlined amber as "check".
- Essays (long text answers) are saved as **drafts** and never autofilled.
- Questions naming the company or pointing at it ("this company", "work here")
  and all drafts are saved **only for that company**; you can change the scope
  in the review list or in Folio.
- Switch it off under Options → "Learned from past forms".

The extension's only write to Folio is `POST /api/ext/answers`, which can add
or update answers and nothing else.

## How it works

```
popup (Fill)  ──fetch, X-Folio-Extension-Key──▶  Folio /api/ext/applicant, /resume-file
   │
   └─ chrome.scripting.executeScript(allFrames) ─▶ content.js in the tab
        collect fields → classify label → fill → report back to popup
```

- `src/classify.js`: label → profile key rules. Unknown questions stay unmatched.
- `src/options.js`: picks the option meaning the same as your saved answer
  (Yes/No, "decline" variants, country aliases); unsure → leaves it.
- `src/content/fields.js`: finds controls and their labels (label[for],
  aria-labelledby, legends, upload groups).
- `src/content/fill.js`: React-safe setters, native selects, radios,
  react-select comboboxes, file upload through `DataTransfer`.
- Only `activeTab` + `scripting`: nothing runs on a page until you click Fill.
  Greenhouse iframes embedded on company sites are covered by the
  `*.greenhouse.io` host permission.

### Greenhouse quirk

Greenhouse's job-boards dropdowns keep `menuIsOpen` in their own wrapper state
and open it on **keyup / mouseup** (forwarded by custom Control/Input
components). React-select's own `mousedown` / `openMenu()` paths do nothing
there. `fillCombobox` sends ArrowDown keydown+keyup first, then a full mouse
sequence, then types to filter for async lists.

## Test

```bash
npm test                 # classifier, option matching, jsdom autofill
npm run fixture          # builds fixtures/dist: the test form, plus the real popup
                         # with chrome.* stubbed at fixtures/dist/popup/index.html
```

`fixtures/greenhouse.html` is a synthetic Greenhouse-like form built with real
React + react-select and the same open/close wiring as the live site. Serve the
`fixtures/` folder on localhost and call
`window.__folioAutofill(applicant, file)` in its console; `window.formState`
shows what React actually registered. Only use synthetic data, and never
automate real company application forms in tests.

## Not yet

- Workday, Lever, Ashby adapters (Workday is multi-step; do it last).
- Application tracking on submit (M6), AI answers for free-text questions (M7).
- A labelled field-mapping eval set from saved real forms, with a held-out split.
