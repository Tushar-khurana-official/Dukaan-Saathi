/**
 * Suggestions built only from data the shop already stores. They are suggestions: the owner decides.
 *  - suggestCreditLimit: how much udhaar this customer has handled and repaid before.
 *  - bestReminderDay: the weekday this customer usually pays on.
 * All amounts are integer paise.
 */
import type { LedgerTx } from './ledger.js';

export interface CreditLimitSuggestion {
  /** null when there is not enough history to suggest anything */
  limit_paise: number | null;
  reason: string;
  /** largest balance this customer built up and later paid back in full */
  max_repaid_paise: number;
  repaid_cycles: number;
}

/** Round to a friendly figure: nearest ₹50 below ₹1,000, nearest ₹100 above. */
function roundLimit(paise: number): number {
  const step = paise < 100_000 ? 5_000 : 10_000;
  return Math.max(10_000, Math.round(paise / step) * step);
}

/**
 * Credit limit suggestion.
 * Looks at every "udhaar cycle": the balance climbs, then is paid back to (almost) zero. The biggest balance
 * that was fully repaid is a level the customer has proven they can handle. The suggestion scales it by the
 * repayment record: more cycles repaid -> a bit more room, an unpaid old balance -> less.
 */
export function suggestCreditLimit(txs: LedgerTx[], score: number, now = new Date()): CreditLimitSuggestion {
  const sorted = [...txs].filter((t) => t.type !== 'sale').sort((a, b) => a.confirmed_at.localeCompare(b.confirmed_at));
  let balance = 0;
  let peak = 0;
  let maxRepaid = 0;
  let cycles = 0;
  for (const t of sorted) {
    balance += t.type === 'credit' ? t.amount_paise : -t.amount_paise;
    peak = Math.max(peak, balance);
    // "cleared" = paid back to within ₹10
    if (t.type === 'payment' && balance <= 1_000 && peak > 0) {
      maxRepaid = Math.max(maxRepaid, peak);
      cycles++;
      peak = Math.max(0, balance);
    }
  }

  if (cycles === 0) {
    return {
      limit_paise: null,
      reason: 'Abhi tak poora udhaar ek baar bhi wapas nahi hua, isliye seema sujhane ke liye data kam hai.',
      max_repaid_paise: 0,
      repaid_cycles: 0,
    };
  }

  let factor = score >= 80 ? 1.25 : score >= 60 ? 1 : 0.75;
  if (cycles >= 3) factor += 0.15;
  // An open balance older than 30 days lowers the suggestion.
  const lastCredit = [...sorted].reverse().find((t) => t.type === 'credit');
  if (balance > 1_000 && lastCredit && now.getTime() - new Date(lastCredit.confirmed_at).getTime() > 30 * 86_400_000) {
    factor -= 0.25;
  }
  const limit = roundLimit(maxRepaid * Math.max(0.5, factor));
  return {
    limit_paise: limit,
    reason: `${cycles} baar poora udhaar chukaya; sabse bada chukaya hua baaki ₹${Math.round(maxRepaid / 100)}.`,
    max_repaid_paise: maxRepaid,
    repaid_cycles: cycles,
  };
}

export const WEEKDAYS_HINGLISH = ['Ravivar', 'Somvar', 'Mangalvar', 'Budhvar', 'Guruvar', 'Shukravar', 'Shanivar'];

export interface ReminderDaySuggestion {
  weekday: number | null; // 0 = Sunday
  label: string | null;
  payments_seen: number;
  /** share of payments that fell on that weekday, 0..1 */
  share: number;
  time_of_day: 'subah' | 'dopahar' | 'shaam' | null;
}

/**
 * The weekday a customer most often pays on (needs at least 3 payments and a clear favourite).
 * Remind a day before or on that day. Falls back to the whole shop's pattern when given all payments.
 */
export function bestReminderDay(txs: LedgerTx[], minPayments = 3): ReminderDaySuggestion {
  const payments = txs.filter((t) => t.type === 'payment');
  const empty: ReminderDaySuggestion = { weekday: null, label: null, payments_seen: payments.length, share: 0, time_of_day: null };
  if (payments.length < minPayments) return empty;
  const days = new Array(7).fill(0);
  const hours = { subah: 0, dopahar: 0, shaam: 0 };
  for (const p of payments) {
    const d = new Date(p.confirmed_at);
    days[d.getDay()]++;
    const h = d.getHours();
    if (h < 12) hours.subah++;
    else if (h < 17) hours.dopahar++;
    else hours.shaam++;
  }
  const best = days.indexOf(Math.max(...days));
  const share = days[best] / payments.length;
  // Needs a real favourite: clearly above an even spread over 7 days.
  if (share < 0.3 || days[best] < 2) return { ...empty, payments_seen: payments.length };
  const time = (Object.entries(hours).sort((a, b) => b[1] - a[1])[0][0]) as ReminderDaySuggestion['time_of_day'];
  return { weekday: best, label: WEEKDAYS_HINGLISH[best], payments_seen: payments.length, share, time_of_day: time };
}
