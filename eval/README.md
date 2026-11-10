# Phase 1 evaluation

## 1. Parser accuracy on 50 utterances (runs offline)

```bash
npm run eval
```

`eval/utterances.json` has 50 shop utterances (22 clean, 28 noisy: fillers, speech-to-text spelling slips,
Devanagari, extra quantities like "2 kilo atta 120 ka", "ek baar", "ke saath") labelled with the expected
intent, customer and amount. The script runs the rule-based parser in `src/lib/khataParser.ts` and prints the
percentage for intent, customer, amount and all three together. `npm test` fails if the result drops below 90%.

Current result: **100% (50/50)**.

Read this number with care: the utterances were written by the developer while building the parser, so it
is a regression baseline, not a field accuracy figure. Add every misheard real utterance from shop testing to
this file before fixing the parser.

## 2. Voice accuracy on real recordings (spec acceptance criterion)

Not measured yet: it needs 50 real voice notes from noisy shops. Steps:

1. Record 50 voice notes in real shops (with the shopkeepers' permission). Save them in `eval/recordings/`
   (git-ignored, because voices are personal data).
2. Label them in `eval/recordings/labels.json`:
   ```json
   [{ "file": "001.webm", "intent": "add_credit", "customer_id": "c-1", "amount": 500 }]
   ```
3. Start the server with a Gemini key: `GEMINI_API_KEY=... npm run dev`
4. Run `npm run eval:voice -- eval/recordings`

The script reports intent, customer, amount and all-three accuracy as percentages, plus Gemini token use
per voice entry (from `GET /api/usage`).

## 3. Cost per voice entry and per shelf photo

The server counts Gemini tokens per call type. Open `http://localhost:3000/api/usage` after using the app.
Set `GEMINI_INPUT_USD_PER_MTOK` and `GEMINI_OUTPUT_USD_PER_MTOK` (current prices for your model) to get a
cost estimate per call. Typed entries that the rule-based parser understands do not call Gemini at all and
are counted as `handled_without_ai`.
