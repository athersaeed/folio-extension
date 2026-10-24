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
   unpacked**, and pick this folder's `dist/`.
4. In Folio, open **Personal profile**, fill in your answers, save, then click
   **Show pairing key** under _Browser extension_.
5. Click the extension icon → Settings, paste the Folio address and the key.

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
npm run fixture          # builds fixtures/dist for the browser fixture
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
