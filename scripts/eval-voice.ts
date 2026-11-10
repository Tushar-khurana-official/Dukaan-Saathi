/**
 * Voice accuracy on REAL recordings (spec acceptance criterion: 50 recordings from noisy shops,
 * reported as a percentage). Sends each audio file through the running server exactly as the app does
 * and compares the parsed entry with the expected label.
 *
 * Usage:
 *   1. Put recordings in a folder, e.g. eval/recordings/ (this folder is git-ignored: it holds voices).
 *   2. Write eval/recordings/labels.json:
 *        [{ "file": "001.webm", "intent": "add_credit", "customer_id": "c-1", "amount": 500 }, ...]
 *      Customer ids refer to the demo customers in src/utils/seedData.ts (or pass --customers my.json).
 *   3. Start the server with GEMINI_API_KEY set:  npm run dev
 *   4. npm run eval:voice -- eval/recordings  [--url http://localhost:3000]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { initialCustomers } from '../src/utils/seedData';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) ?? 'eval/recordings';
const urlIdx = args.indexOf('--url');
const baseUrl = urlIdx >= 0 ? args[urlIdx + 1] : 'http://localhost:3000';
const custIdx = args.indexOf('--customers');
const customers: Array<{ id: string; name: string }> =
  custIdx >= 0 ? JSON.parse(readFileSync(args[custIdx + 1], 'utf8')) : initialCustomers.map((c) => ({ id: c.id, name: c.name }));

const MIME: Record<string, string> = { '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav' };

interface Label { file: string; intent: string; customer_id: string | null; amount: number | null }

async function main() {
  const labels = JSON.parse(readFileSync(path.join(dir, 'labels.json'), 'utf8')) as Label[];
  const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ai) {
    console.error('Server is not running with a GEMINI_API_KEY; voice cannot be transcribed. Start it with the key set.');
    process.exit(1);
  }

  let intentOk = 0, customerOk = 0, amountOk = 0, allOk = 0;
  for (const l of labels) {
    const audio = readFileSync(path.join(dir, l.file));
    const res = await fetch(`${baseUrl}/api/gemini/parse-khata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: audio.toString('base64'),
        audioMimeType: MIME[path.extname(l.file).toLowerCase()] ?? 'audio/webm',
        customers,
        language: 'hinglish',
      }),
    }).then((r) => r.json());
    const amount = res.amount_paise == null ? null : res.amount_paise / 100;
    const ok = [res.intent === l.intent, res.matched_customer_id === l.customer_id, amount === l.amount];
    if (ok[0]) intentOk++;
    if (ok[1]) customerOk++;
    if (ok[2]) amountOk++;
    if (ok.every(Boolean)) allOk++;
    else console.log(`✗ ${l.file}: heard "${res.transcript}" -> ${res.intent} / ${res.matched_customer_id} / ${amount}`);
  }
  const pct = (n: number) => `${Math.round((n / labels.length) * 1000) / 10}%`;
  console.log(`\nVoice accuracy on ${labels.length} recordings (${dir})`);
  console.log(`  intent   ${pct(intentOk)}\n  customer ${pct(customerOk)}\n  amount   ${pct(amountOk)}\n  all three right: ${pct(allOk)}`);
  const usage = await fetch(`${baseUrl}/api/usage`).then((r) => r.json()).catch(() => null);
  if (usage) console.log('\nGemini usage per voice entry:', JSON.stringify(usage.usage.voice_entry));
}

main();
