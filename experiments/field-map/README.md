# Field-mapping eval: rules vs OpenRouter models

Run November 4, 2026. A standalone experiment: the extension still fills with the
rules in `src/classify.js` only. Total spend across all runs: **$0.043**.

## Conclusion

**Don't add an LLM to the fill path yet.** On questions it had never been tuned
on, the rules classifier was already 119/126 right (94%) with 2 wrong fills. The
best LLM setups added 1–4 right answers, which is within the run-to-run noise
(Gemma moved by 2 fields between two identical practice runs). The cheaper fix is
the 7 rule misses below, plus the rule guards for the wrong fills.

If an LLM is added later, use it as a **double-check** ("strict agree": fill only
when rules and model give the same key). That cut wrong fills to 0–1 on both
splits, but it leaves more fields blank and adds 0.3–0.9 s per form. Sending
only the fields the rules left blank, the original plan, made things _worse_: most
blank fields have no matching key, and the model forces one onto some of them.

## Data

- `collect.mjs`: application questions from Greenhouse's public job-board API
  (`boards-api.greenhouse.io`, read only): 41 companies, 82 jobs, 1,915 fields →
  `forms.json`.
- `split.mjs`: deduplicated to 471 distinct questions, split **by company**
  (every 3rd board alphabetically is held out). Held-out questions also seen on a
  practice board were dropped, so held-out is genuinely unseen.
- `label-practice.mjs`, `label-heldout.mjs`: hand-written gold keys (or "none";
  some ambiguous fields accept more than one answer). Held-out was labelled
  before any model or prompt saw it.
  - practice: 345 questions, 161 with a profile key
  - held-out: 126 questions, 55 with a profile key

## Results

"Right" counts a correct key _and_ a correct "none". A wrong key is worse than a
miss: a miss leaves the box blank for you; a wrong key puts the wrong answer in.

### Practice (prompt and setups tuned here)

All 7 models, "every field" setup (model maps all fields):

| Model                             | Right   | Wrong | Median ms | Cost    |
| --------------------------------- | ------- | ----- | --------- | ------- |
| rules only                        | 329/345 | 9     | —         | 0       |
| anthropic/claude-haiku-5.5        | 338/345 | 5     | 999       | $0.0066 |
| google/gemma-4-26b-a4b-it         | 335/345 | 9     | 296       | $0.0028 |
| mistralai/ministral-8b-2512       | 335/345 | 6     | 543       | $0.0041 |
| mistralai/ministral-3b-2512       | 324/345 | 9     | 479       | $0.0026 |
| nvidia/nemotron-3.5-lightning     | 318/345 | 19    | 244       | $0.0019 |
| nvidia/nemotron-3-nano-30b-a3b    | 314/345 | 16    | 453       | $0.0031 |
| inference-net/schematron-v2-turbo | 190/345 | 12    | 299       | $0.0018 |

Schematron mostly answered "none" (143 misses). Nemotron Lightning had one
broken JSON reply. Both Nemotrons made 2x the wrong fills of the top three.

### Held-out (scored once, top three from practice)

| Approach                   | Gemma 4       | Haiku 5.5     | Ministral 8B  |
| -------------------------- | ------------- | ------------- | ------------- |
| rules only                 | 119 / 2 wrong | 119 / 2 wrong | 119 / 2 wrong |
| rules + model on blanks    | 120 / 6       | 123 / 3       | 121 / 4       |
| model on every field       | 121 / 5       | 121 / 2       | 121 / 3       |
| agree (model fills blanks) | 120 / 5       | 120 / 2       | 120 / 3       |
| strict agree               | 119 / 1       | 116 / 1       | 118 / 1       |
| median ms per batch        | 422           | 881           | 454           |

(right out of 126 / wrong fills)

## What the rules got wrong on held-out

- Wrong: "Please email me about future job openings" → email;
  "If you're not authorized…, what sponsorship would you require?" → sponsorship.
- Missed: "What's the name you'd prefer us to use…" (preferred name),
  "What is your military status?" (veteran), "What country are you based in?" and
  "Are you currently based in any of these countries?" (country), "Which
  categories describe you?" with race options.

Several practice misses were the same kinds ("Please identify your sex",
"Where have you learned about Samsara?", "When is the earliest you would want to
start"). Fixing those is a rules change, tuned on practice; held-out is now spent
and must not be used to judge the fix.

## Caveats

- One labeller (Claude), Greenhouse only. Lever, Ashby and Workday word things
  differently.
- Scored on _distinct_ questions. Real forms repeat the easy fields (name, email),
  so per-form accuracy is higher than these numbers.
- The rules were partly written from Greenhouse forms, which flatters them on
  practice; held-out companies were never used to write rules.

## Running it

```bash
node collect.mjs && node split.mjs && node label-practice.mjs && node label-heldout.mjs
node score-rules.mjs practice
node --env-file="../../../folio parser llm/.env" compare.mjs practice
```

`compare.mjs` sends only labels, field types and option text (never profile
values), asks providers not to keep data, and stops at `BUDGET_USD` ($1).
Results land in `results/`.

## Follow-up: rule fixes (same day)

`src/classify.js` now covers the missed wordings above and guards follow-up
"please list / explain" boxes, email or SMS opt-ins, and two-part questions
("within 50 miles, or able to relocate before your start date?").

- Practice: **344/345, 1 wrong** (was 329/345, 9 wrong). The remaining one is
  "Please identify your ethnicity." with Hispanic / Not Hispanic options, which
  needs option-aware classification.
- Held-out was **not** re-scored: several fixes target wordings first seen in
  held-out (preferred name, military status, country), so its score would no
  longer be a fair measure. A fresh held-out needs new companies.
