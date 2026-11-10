import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateV1 } from '../src/lib/storage';

test('v1 data migrates: rupees -> paise, phone dropped without consent, statuses not counts', () => {
  const out = migrateV1({
    profile: { name: 'Shop', owner: 'A', upi_id: 'a@b', language: 'hinglish', consent_accepted: true, phone: '9811111111' },
    customers: [{ id: 'c1', name: 'X', phone: '9822222222', note: '', created_at: '2026-01-01' }],
    transactions: [{ id: 't1', customer_id: 'c1', type: 'credit', amount: 499.5, note: '', date: '2026-01-02', source: 'photo' }],
    reminders: [{ id: 'r1', customer_id: 'c1', customer_name: 'X', amount: 100, sent_at: '2026-01-03', message_preview: 'hi', tone: 'polite' }],
    catalog: [{ id: 'p1', name: 'Salt', category: 'S', min_level: 10, current_level: 0, unit: 'pkt', supplier_name: '', supplier_phone: '' }],
  });
  assert.equal(out.transactions[0].amount_paise, 49950);
  assert.equal(out.transactions[0].confirmed_at, '2026-01-02');
  assert.equal(out.transactions[0].source, 'manual');
  assert.equal(out.customers[0].phone, '');
  assert.equal(out.customers[0].consent_given_at, null);
  assert.equal(out.reminders[0].link_opened_at, '2026-01-03');
  assert.equal(out.reminders[0].amount_paise, 10000);
  assert.equal(out.catalog[0].stock_status, 'out');
  assert.equal(out.profile?.owner_phone, '9811111111');
  assert.ok(!('current_level' in out.catalog[0]));
});
