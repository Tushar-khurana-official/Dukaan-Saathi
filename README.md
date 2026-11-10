# Dukaan Saathi

A WhatsApp-style web app for small Indian kirana shops. The owner records udhaar (credit), payments and sales by
voice or text in Hindi, English or Hinglish, sends UPI payment reminders through WhatsApp, checks shelf gaps
from a photo, and sees a simple daily dashboard.

**Status:** a working prototype. It follows the build spec *Dukaan Saathi: App Build Spec* (10 Nov 2026).
Phase 1 ("harden the prototype") is done in code. Phases 2–6 are not started, because the spec says to finish
each phase and test it with real shopkeepers first. The WhatsApp chat inside the app is a simulation.

## Run it

```bash
npm install
cp .env.example .env      # optional: add GEMINI_API_KEY for voice notes and shelf photos
npm run dev               # http://localhost:3000
```

Without a Gemini key the app still works: typed entries go through the rule-based parser, and shelf photos
return a clearly marked demo result. Voice notes need the key; without it the browser's own speech
recognition transcript is used when the browser has one.

| Command | What it does |
| --- | --- |
| `npm run dev` | Express server + Vite dev server |
| `npm run build` then `npm start` | Production build served by the same server |
| `npm test` | 58 unit tests (parser, matching, ledger maths, reminders, shelf rules, migration) |
| `npm run eval` | Parser accuracy on the 50 utterances in `eval/utterances.json` |
| `npm run eval:voice -- <folder>` | Accuracy on real recordings (see `eval/README.md`) |
| `npm run lint` | TypeScript check |

## How the spec maps to the code

### Core flows

| Spec | Where | Notes |
| --- | --- | --- |
| Voice udhaar entry, "Sahi hai?" before saving | `src/components/assistant/AssistantChat.tsx` | Every credit, payment or sale shows a card. Only "Haan, sahi hai" saves. "Badlo" lets the owner change customer (fuzzy suggestions first, or a new customer), amount, type and note. Unsure parses open in edit mode, and the save button stays disabled until a customer and amount are set. |
| Hindi number words ("paanch sau" → 500) | `src/lib/hindiNumbers.ts` | sau / hazaar / lakh, dedh, dhai, saade, sawa, paune, Devanagari words and digits, ₹ and "rupaye", "1.5k". Quantities ("2 kilo") and phone numbers are never read as money. Ambiguous words ("do", "saath", "ek") only count before a multiplier. |
| Customer name matching ("Sharma ji" → right record) | `src/lib/customerMatch.ts` | Jaro-Winkler on phonetic keys, Devanagari transliteration, honorifics ignored, relation words ("chachi") weighted. Unknown names are never forced onto a customer; two close matches are flagged as ambiguous. |
| Payment reminder, nothing sent automatically | `src/components/reminders/RemindersScreen.tsx`, `src/lib/reminders.ts` | Message in Hinglish, Hindi or English, three tones, saved as per-shop settings. Opens a prefilled `wa.me` link; the owner taps send in WhatsApp. The log records `link_opened_at`, not "sent". |
| Shelf photo: gaps and low stock, no unit counts | `src/lib/shelf.ts`, `src/components/stock/StockScreen.tsx` | The prompt forbids counts and `sanitizeDetections` strips any count that comes back ("sirf 2 packet bache" → "thoda hi stock"). The catalog stores a status (ok / low / out / unknown), never a number. Scan history, comparison with the previous scan, reorder list, CSV export and WhatsApp order to the supplier. |
| Daily dashboard | `src/components/home/HomeDashboard.tsx`, `src/lib/ledger.ts` | Sales, money pending, money recovered, new udhaar, low-stock items, overdue customers, top products and top customers (7 days), 7-day chart. All numbers come from the same functions over the transaction log. |
| Saathi chat with language toggle | `AssistantChat.tsx`, `Header.tsx` | Also answers balance questions, "kis kis ka baaki hai" and "aaj ka hisaab". |

### Data model (`src/types/index.ts`)

Matches the spec table. Amounts are integer **paise** everywhere (`amount_paise`, `mrp_paise`); rupees only
appear at the edges (input boxes, display, UPI links). Every record has `shop_id`. Customer has
`consent_given_at`; Transaction has `confirmed_at` and `type` credit / payment / sale; Product has `aliases`
and `low_stock_threshold`; ShelfScan has `image_ref` and `detected_items`; Reminder has `link_opened_at`.
Customer balance is derived from the transaction log rather than stored, so it cannot drift.
Data saved by the older prototype (rupee amounts) is migrated once on load (`src/lib/storage.ts`).

### Privacy and consent (DPDP)

| Spec rule | How it is handled |
| --- | --- |
| Consent before storing a phone number, with the date | Add-customer and "+ Number jodein" forms require a consent tick; `consent_given_at` is saved. A phone number without consent is dropped. Consent can be withdrawn (the number is deleted, the khata stays). |
| Tell the shop what the data is for | Onboarding notice and Settings: udhaar tracking and payment reminders only. |
| Export or delete a customer's data | Khata → customer → "Grahak ka data export" (JSON) / "Data delete karein" (customer, transactions and reminders). |
| Balances visible only to the owning shop | Data lives only in this browser in the prototype. Real per-shop isolation needs login (Phase 2). |
| Admin panel shows aggregates only | Not built (Phase 6). |
| No names or phone numbers in server logs | The server logs JSON events with sizes, timings and token counts only. Request bodies are never logged. |
| Reminders contain only amount, shop name and UPI link | Templates are fixed code (no AI), with no customer name; a test checks every language and tone. |

Also: phone numbers are never sent to Gemini (only customer ids and names), and the privacy notice says so.
This is a product requirement, not legal advice; get a lawyer to review it before a real pilot.

### AI cost

`server.ts` calls Gemini only for voice notes, shelf photos, the festival planner, and typed text that the
rule-based parser is unsure about. Daily summaries and reminders no longer use AI. Gemini output is
cross-checked: the amount and customer id are re-derived by our own code. `GET /api/usage` shows token use
per voice entry and per shelf photo, and a cost estimate if you set the price env vars (see `.env.example`).

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| "Sharma ji ko 500 udhaar" creates a 500 credit only after the owner confirms | ✅ Done; unit test plus browser check |
| Wrong customer name or amount can be corrected before saving | ✅ Done; browser check (₹150 edited to ₹175, ₹175 saved) |
| Reminder opens WhatsApp with amount and UPI link; nothing sent until the owner taps send | ✅ Done; prefilled `wa.me` link, tested |
| Shelf photo flags low or missing items, never exact counts | ✅ Done; prompt rule plus sanitiser plus tests |
| Dashboard totals match the transaction log for the same date range | ✅ Done; property test over 20 random logs |
| Admin panel shows no names, phones or individual balances | ⏳ Not started; the admin panel is Phase 6 |
| Voice accuracy measured on 50 real noisy recordings, as a percentage | ⏳ Harness ready (`npm run eval:voice`); needs real recordings |

Parser accuracy on the 50-utterance set is 100%. Those utterances were written while building the parser, so
treat the figure as a regression baseline, not field accuracy (see `eval/README.md`).

## Build phases

1. **Harden the prototype** — done in code: number parsing, fuzzy matching, 50-utterance eval, paise data
   model, consent, deterministic reminders, count-free shelf results. Still to do: test with real shopkeepers
   and run the real-recording voice eval.
2. **Backend** (FastAPI, database, login, per-shop data) — not started. Database, hosting and the Hindi
   speech-to-text provider are open questions in the spec. Gemini calls already run on the server
   (`server.ts`), so the API key is not exposed.
3. **WhatsApp Cloud API** — not started (needs a backend and Meta approval).
4. **Reminders** — templates, per-shop settings and manual send are done; automatic sending waits for
   Phase 3 and the owner's approval.
5. **Shelf scanner and reorder** — history, comparison and reorder export exist in the prototype.
6. **Dashboard and admin** — repayment speed and top products exist; trends, slow products, supplier spend
   and the aggregate-only admin panel are not built.

Not in scope (spec): in-app payments, GST invoicing, multi-shop chains, exact inventory counts, automatic
WhatsApp sending before Cloud API approval. Open questions: pricing, speech-to-text provider, database and
hosting, data retention, competitor features (not checked).

## Deployment note

On Vercel only the static frontend is deployed, so `/api/*` does not exist there. The app then falls back
to the in-browser rule-based parser for typed entries and shows demo shelf results. Run `npm start` on a
Node host to get voice notes and real shelf analysis.
