import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestReminderDay, suggestCreditLimit } from '../src/lib/customerInsights';
import { buildReceiptMessage, buildStatementMessage } from '../src/lib/reminders';
import { makeStatementToken, newStatementKey, parseStatementToken } from '../src/lib/statement';
import type { LedgerTx } from '../src/lib/ledger';

const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h).toISOString();
const tx = (i: number, type: LedgerTx['type'], rupees: number, when: string): LedgerTx => ({
  id: `t${i}`, customer_id: 'c', type, amount_paise: rupees * 100, confirmed_at: when,
});

test('credit limit: needs at least one fully repaid cycle', () => {
  const s = suggestCreditLimit([tx(1, 'credit', 500, at(2026, 10, 1))], 70);
  assert.equal(s.limit_paise, null);
});

test('credit limit: based on the biggest repaid balance, scaled by score, rounded', () => {
  const log = [
    tx(1, 'credit', 800, at(2026, 9, 1)),
    tx(2, 'credit', 400, at(2026, 9, 5)), // peak 1200
    tx(3, 'payment', 1200, at(2026, 9, 20)), // cleared
    tx(4, 'credit', 600, at(2026, 10, 1)),
    tx(5, 'payment', 600, at(2026, 10, 8)), // cleared
  ];
  const good = suggestCreditLimit(log, 85, new Date(2026, 10, 1));
  assert.equal(good.repaid_cycles, 2);
  assert.equal(good.max_repaid_paise, 120000);
  assert.equal(good.limit_paise, 150000); // 1200 x 1.25
  const weak = suggestCreditLimit(log, 50, new Date(2026, 10, 1));
  assert.equal(weak.limit_paise, 90000); // 1200 x 0.75
  assert.equal(good.limit_paise! % 5000, 0);
});

test('best reminder day: picks the usual payment weekday, needs enough payments', () => {
  // 2026-11-01 is a Sunday
  const sundays = [1, 8, 15, 22].map((d, i) => tx(i, 'payment', 100, at(2026, 11, d, 19)));
  const r = bestReminderDay([...sundays, tx(9, 'payment', 100, at(2026, 11, 4, 10))]);
  assert.equal(r.weekday, 0);
  assert.equal(r.label, 'Ravivar');
  assert.equal(r.time_of_day, 'shaam');
  assert.equal(bestReminderDay(sundays.slice(0, 2)).weekday, null); // too few
  // spread evenly over 7 days -> no favourite
  const spread = [1, 2, 3, 4, 5, 6, 7].map((d, i) => tx(i, 'payment', 100, at(2026, 11, d)));
  assert.equal(bestReminderDay(spread).weekday, null);
});

test('receipt: entry, new balance, shop and statement link; no phone numbers', () => {
  for (const language of ['hinglish', 'hindi', 'english'] as const) {
    const m = buildReceiptMessage({
      type: 'credit', amountPaise: 25000, balancePaise: 175000, shopName: 'Gupta Kirana', language,
      statementUrl: 'https://x.test/s/abc',
    });
    assert.ok(m.includes('₹250') && m.includes('₹1,750') && m.includes('Gupta Kirana') && m.includes('https://x.test/s/abc'), m);
    assert.ok(!/\d{10}/.test(m));
  }
  assert.ok(buildStatementMessage({ shopName: 'S', url: 'https://x.test/s/a', language: 'hinglish' }).includes('https://x.test/s/a'));
});

test('statement tokens round-trip and reject junk', () => {
  const key = newStatementKey();
  assert.match(key, /^[0-9a-f]{36}$/);
  const token = makeStatementToken('shop_abc', 'cust-1', key);
  assert.deepEqual(parseStatementToken(token), { shopId: 'shop_abc', customerId: 'cust-1', key });
  assert.equal(parseStatementToken('not a token'), null);
  assert.equal(parseStatementToken(makeStatementToken('a', 'b', 'short')), null);
});
