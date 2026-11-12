import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  computeBalances,
  dailySeries,
  LedgerTx,
  pendingAsOf,
  repaymentSpeedDays,
  startOfDay,
  summarizeRange,
} from '../src/lib/ledger';
import { initialTransactions } from '../src/utils/seedData';
import { formatPaise, parseRupeeInput, paiseToUpiAmount, rupeesToPaise } from '../src/lib/money';

/** Deterministic pseudo-random log for property-style checks. */
function randomLog(seed: number, n: number): LedgerTx[] {
  let x = seed;
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const types = ['credit', 'payment', 'sale'] as const;
  const base = Date.UTC(2026, 9, 1);
  return Array.from({ length: n }, (_, i) => {
    const type = types[Math.floor(rnd() * 3)];
    return {
      id: `t${i}`,
      customer_id: type === 'sale' ? null : `c${Math.floor(rnd() * 5)}`,
      type,
      amount_paise: 100 + Math.floor(rnd() * 500000),
      confirmed_at: new Date(base + Math.floor(rnd() * 40 * 86_400_000)).toISOString(),
    };
  });
}

test('acceptance: dashboard totals equal the transaction log for the same date range', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const log = randomLog(seed, 300);
    const from = new Date(Date.UTC(2026, 9, 5 + (seed % 10)));
    const to = addDays(from, 1 + (seed % 7));
    const s = summarizeRange(log, from, to);
    const inRange = log.filter((t) => t.confirmed_at >= from.toISOString() && t.confirmed_at < to.toISOString());
    const sum = (type: string) => inRange.filter((t) => t.type === type).reduce((a, t) => a + t.amount_paise, 0);
    assert.equal(s.sales_paise, sum('sale'));
    assert.equal(s.credit_given_paise, sum('credit'));
    assert.equal(s.recovered_paise, sum('payment'));
    assert.equal(s.transaction_count, inRange.length);
  }
});

test('daily series adds up to the 7-day range total', () => {
  const now = new Date();
  const series = dailySeries(initialTransactions, 7, now);
  const week = summarizeRange(initialTransactions, addDays(startOfDay(now), -6), addDays(startOfDay(now), 1));
  assert.equal(series.reduce((a, d) => a + d.sales_paise, 0), week.sales_paise);
  assert.equal(series.reduce((a, d) => a + d.credit_given_paise, 0), week.credit_given_paise);
  assert.equal(series.reduce((a, d) => a + d.recovered_paise, 0), week.recovered_paise);
});

test('pending = sum of positive balances; sales never change balances', () => {
  const log = randomLog(7, 200);
  const balances = computeBalances(log);
  let expected = 0;
  balances.forEach((b) => (expected += Math.max(0, b.balance)));
  assert.equal(pendingAsOf(log, new Date(8.64e15)), expected);
  assert.equal(balances.has('null'), false);
});

test('all seed amounts are whole paise', () => {
  for (const t of initialTransactions) assert.ok(Number.isInteger(t.amount_paise) && t.amount_paise > 0, t.id);
});

test('money helpers', () => {
  assert.equal(rupeesToPaise(1.5), 150);
  assert.equal(rupeesToPaise(0.1 + 0.2), 30); // no float drift
  assert.equal(parseRupeeInput('1,250.50'), 125050);
  assert.equal(parseRupeeInput('12.345'), null);
  assert.equal(parseRupeeInput('abc'), null);
  assert.equal(formatPaise(12500000), '₹1,25,000');
  assert.equal(formatPaise(125050), '₹1,250.50');
  assert.equal(paiseToUpiAmount(50000), '500');
  assert.equal(paiseToUpiAmount(50005), '500.05');
});

test('repayment speed uses first-in-first-out', () => {
  const d = (day: number) => new Date(Date.UTC(2026, 9, day)).toISOString();
  const log: LedgerTx[] = [
    { id: '1', customer_id: 'a', type: 'credit', amount_paise: 1000, confirmed_at: d(1) },
    { id: '2', customer_id: 'a', type: 'credit', amount_paise: 1000, confirmed_at: d(5) },
    { id: '3', customer_id: 'a', type: 'payment', amount_paise: 1000, confirmed_at: d(11) }, // clears day-1 credit: 10 days
    { id: '4', customer_id: 'a', type: 'payment', amount_paise: 1000, confirmed_at: d(9 + 5) }, // clears day-5 credit: 9 days
  ];
  assert.equal(repaymentSpeedDays(log).overall, 9.5);
});
