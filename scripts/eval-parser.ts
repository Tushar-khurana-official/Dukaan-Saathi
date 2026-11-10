/**
 * Phase 1 accuracy check for the rule-based khata parser.
 * Usage: npm run eval            (prints a table and the accuracy percentages)
 *        npm run eval -- --json  (machine-readable result)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseKhataText } from '../src/lib/khataParser';
import { initialCustomers } from '../src/utils/seedData';

interface Utterance {
  id: number;
  text: string;
  intent: string;
  customer_id: string | null;
  amount: number | null;
  noisy?: boolean;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(path.join(here, '..', 'eval', 'utterances.json'), 'utf8')) as {
  utterances: Utterance[];
};

export function runEval() {
  const rows = data.utterances.map((u) => {
    const p = parseKhataText(u.text, initialCustomers);
    const amount = p.amount_paise === null ? null : p.amount_paise / 100;
    const intentOk = p.intent === u.intent;
    const customerOk = p.matched_customer_id === u.customer_id;
    const amountOk = amount === u.amount;
    return { u, p, amount, intentOk, customerOk, amountOk, allOk: intentOk && customerOk && amountOk };
  });
  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);
  const count = (f: (r: (typeof rows)[number]) => boolean, subset = rows) => subset.filter(f).length;
  const noisy = rows.filter((r) => r.u.noisy);
  const clean = rows.filter((r) => !r.u.noisy);
  return {
    rows,
    summary: {
      total: rows.length,
      intent: pct(count((r) => r.intentOk), rows.length),
      customer: pct(count((r) => r.customerOk), rows.length),
      amount: pct(count((r) => r.amountOk), rows.length),
      exact: pct(count((r) => r.allOk), rows.length),
      clean_exact: pct(count((r) => r.allOk, clean), clean.length),
      noisy_exact: pct(count((r) => r.allOk, noisy), noisy.length),
      clean_count: clean.length,
      noisy_count: noisy.length,
    },
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { rows, summary } = runEval();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    for (const r of rows) {
      if (r.allOk) continue;
      console.log(
        `✗ #${r.u.id} "${r.u.text}"\n    expected ${r.u.intent} / ${r.u.customer_id} / ${r.u.amount}` +
          `\n    got      ${r.p.intent} / ${r.p.matched_customer_id} / ${r.amount}`,
      );
    }
    console.log('\nKhata parser accuracy on eval/utterances.json');
    console.log(`  utterances      : ${summary.total} (${summary.clean_count} clean, ${summary.noisy_count} noisy)`);
    console.log(`  intent          : ${summary.intent}%`);
    console.log(`  customer        : ${summary.customer}%`);
    console.log(`  amount          : ${summary.amount}%`);
    console.log(`  all three right : ${summary.exact}%  (clean ${summary.clean_exact}%, noisy ${summary.noisy_exact}%)`);
    console.log('\nNote: these are typed/transcribed texts. Voice accuracy on real recordings is measured separately (see eval/README.md).');
  }
}
