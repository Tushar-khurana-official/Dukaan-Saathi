import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKhataText } from '../src/lib/khataParser';
import { initialCustomers } from '../src/utils/seedData';
import { runEval } from '../scripts/eval-parser';

test('acceptance: "Sharma ji ko 500 udhaar" -> 500 credit for Sharma ji (in paise)', () => {
  const p = parseKhataText('Sharma ji ko 500 udhaar', initialCustomers);
  assert.equal(p.intent, 'add_credit');
  assert.equal(p.matched_customer_id, 'c-1');
  assert.equal(p.amount_paise, 50000);
  assert.ok(Number.isInteger(p.amount_paise));
  assert.equal(p.needs_clarification, false);
});

test('payment by "ne ... diye"', () => {
  const p = parseKhataText('Sunita Verma ne teen sau diye', initialCustomers);
  assert.equal(p.intent, 'add_payment');
  assert.equal(p.matched_customer_id, 'c-2');
  assert.equal(p.amount_paise, 30000);
});

test('unknown customer asks a question instead of guessing', () => {
  const p = parseKhataText('Ramu ji ko 500 udhaar', initialCustomers);
  assert.equal(p.matched_customer_id, null);
  assert.equal(p.needs_clarification, true);
  assert.equal(p.customer_name, 'Ramu Ji');
});

test('missing amount asks for the amount', () => {
  const p = parseKhataText('Sharma ji ko udhaar likho', initialCustomers);
  assert.equal(p.amount_paise, null);
  assert.equal(p.needs_clarification, true);
});

test('counter sale needs no customer', () => {
  const p = parseKhataText('aaj 2000 ki bikri hui', initialCustomers);
  assert.equal(p.intent, 'add_sale');
  assert.equal(p.amount_paise, 200000);
});

test('eval set: 50 utterances, at least 90% fully correct', () => {
  const { summary } = runEval();
  assert.equal(summary.total, 50);
  assert.ok(summary.exact >= 90, `exact accuracy ${summary.exact}% < 90%`);
});
