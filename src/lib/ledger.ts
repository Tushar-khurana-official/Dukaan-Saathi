/**
 * Pure ledger maths over the transaction log. Every number on the dashboard comes from here,
 * so dashboard totals always equal a sum over the same log for the same date range.
 * All amounts are integer paise.
 */

export type LedgerTxType = 'credit' | 'payment' | 'sale';

export interface LedgerTx {
  id: string;
  customer_id: string | null;
  type: LedgerTxType;
  amount_paise: number;
  confirmed_at: string; // ISO date-time
  note?: string;
}

export interface CustomerBalance {
  balance: number; // paise owed to the shop (credit - payment)
  creditTotal: number;
  paymentTotal: number;
  lastTxDate?: string;
}

export function computeBalances(transactions: LedgerTx[], customerIds: string[] = []): Map<string, CustomerBalance> {
  const map = new Map<string, CustomerBalance>();
  for (const id of customerIds) map.set(id, { balance: 0, creditTotal: 0, paymentTotal: 0 });
  const sorted = [...transactions].sort((a, b) => a.confirmed_at.localeCompare(b.confirmed_at));
  for (const tx of sorted) {
    if (!tx.customer_id || tx.type === 'sale') continue;
    const entry = map.get(tx.customer_id) ?? { balance: 0, creditTotal: 0, paymentTotal: 0 };
    if (tx.type === 'credit') {
      entry.balance += tx.amount_paise;
      entry.creditTotal += tx.amount_paise;
    } else {
      entry.balance -= tx.amount_paise;
      entry.paymentTotal += tx.amount_paise;
    }
    entry.lastTxDate = tx.confirmed_at;
    map.set(tx.customer_id, entry);
  }
  return map;
}

/** Local-time start of the day containing `date`. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface RangeSummary {
  from: string;
  to: string; // exclusive
  sales_paise: number; // cash/counter sales recorded as 'sale'
  credit_given_paise: number; // new udhaar
  recovered_paise: number; // payments received against udhaar
  transaction_count: number;
}

/** Totals for transactions with from <= confirmed_at < to. */
export function summarizeRange(transactions: LedgerTx[], from: Date, to: Date): RangeSummary {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const summary: RangeSummary = {
    from: from.toISOString(),
    to: to.toISOString(),
    sales_paise: 0,
    credit_given_paise: 0,
    recovered_paise: 0,
    transaction_count: 0,
  };
  for (const tx of transactions) {
    const t = new Date(tx.confirmed_at).getTime();
    if (t < fromMs || t >= toMs) continue;
    summary.transaction_count++;
    if (tx.type === 'sale') summary.sales_paise += tx.amount_paise;
    else if (tx.type === 'credit') summary.credit_given_paise += tx.amount_paise;
    else summary.recovered_paise += tx.amount_paise;
  }
  return summary;
}

/** Money pending = sum of positive customer balances using transactions up to `asOf` (exclusive). */
export function pendingAsOf(transactions: LedgerTx[], asOf: Date): number {
  const cutoff = asOf.getTime();
  const balances = computeBalances(transactions.filter((t) => new Date(t.confirmed_at).getTime() < cutoff));
  let sum = 0;
  balances.forEach((b) => {
    if (b.balance > 0) sum += b.balance;
  });
  return sum;
}

/** Per-day buckets for the last `days` days ending today (local time). */
export function dailySeries(transactions: LedgerTx[], days: number, now = new Date()) {
  const today = startOfDay(now);
  const out: Array<RangeSummary & { label: string; date: string }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const from = addDays(today, -i);
    const to = addDays(from, 1);
    out.push({
      ...summarizeRange(transactions, from, to),
      date: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`,
      label: from.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
    });
  }
  return out;
}

/** Customers ranked by udhaar given in the range (ties broken by name). */
export function topCustomersByCredit(transactions: LedgerTx[], from: Date, to: Date, limit = 5) {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    const t = new Date(tx.confirmed_at).getTime();
    if (tx.type !== 'credit' || !tx.customer_id || t < from.getTime() || t >= to.getTime()) continue;
    totals.set(tx.customer_id, (totals.get(tx.customer_id) ?? 0) + tx.amount_paise);
  }
  return [...totals.entries()]
    .map(([customer_id, credit_paise]) => ({ customer_id, credit_paise }))
    .sort((a, b) => b.credit_paise - a.credit_paise)
    .slice(0, limit);
}

/**
 * Average days from a credit to the payment that clears it (FIFO), per customer and overall.
 * Only credits that are fully repaid count.
 */
export function repaymentSpeedDays(transactions: LedgerTx[]): { overall: number | null; byCustomer: Map<string, number> } {
  const byCustomer = new Map<string, number>();
  const allDurations: number[] = [];
  const grouped = new Map<string, LedgerTx[]>();
  for (const tx of transactions) {
    if (!tx.customer_id || tx.type === 'sale') continue;
    if (!grouped.has(tx.customer_id)) grouped.set(tx.customer_id, []);
    grouped.get(tx.customer_id)!.push(tx);
  }
  grouped.forEach((txs, customerId) => {
    const queue: Array<{ remaining: number; at: number }> = [];
    const durations: number[] = [];
    for (const tx of [...txs].sort((a, b) => a.confirmed_at.localeCompare(b.confirmed_at))) {
      const at = new Date(tx.confirmed_at).getTime();
      if (tx.type === 'credit') {
        queue.push({ remaining: tx.amount_paise, at });
        continue;
      }
      let pay = tx.amount_paise;
      while (pay > 0 && queue.length > 0) {
        const head = queue[0];
        const used = Math.min(head.remaining, pay);
        head.remaining -= used;
        pay -= used;
        if (head.remaining === 0) {
          durations.push((at - head.at) / 86_400_000);
          queue.shift();
        }
      }
    }
    if (durations.length > 0) {
      const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
      byCustomer.set(customerId, Math.round(avg * 10) / 10);
      allDurations.push(...durations);
    }
  });
  const overall = allDurations.length
    ? Math.round((allDurations.reduce((s, d) => s + d, 0) / allDurations.length) * 10) / 10
    : null;
  return { overall, byCustomer };
}
