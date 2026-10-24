# Folio Autofill extension

Chrome MV3 extension that fills job applications from the local Folio server
(`../folio parser llm`, routes under `/api/ext/*`). See README.md.

- Fill only on explicit user click; never submit, never overwrite a non-empty field.
- Never guess: unknown labels stay unmatched, ambiguous options stay unpicked.
- The pairing key is only sent to a loopback Folio address.
- Tests use synthetic data only. Do not automate real company application forms;
  reproduce their markup in `fixtures/` instead.
- Run `npm test` and `npm run build` after changes; re-check the fixture for fill-engine changes.
