import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCustomer } from '../src/lib/customerMatch';
import { initialCustomers } from '../src/utils/seedData';

const expectMatch = (spoken: string, id: string | null) =>
  test(`match "${spoken}" -> ${id}`, () => {
    assert.equal(matchCustomer(spoken, initialCustomers).best?.customer.id ?? null, id);
  });

expectMatch('Sharma ji', 'c-1'); // matches "Sharma Ji (Gali 3)"
expectMatch('sarma ji', 'c-1'); // spelling slip
expectMatch('शर्मा जी', 'c-1'); // Devanagari
expectMatch('sunita werma', 'c-2');
expectMatch('tailor wale', 'c-3');
expectMatch('doctor sahab', 'c-7');
expectMatch('chachi', 'c-8');
expectMatch('Ramu ji', null); // unknown name must not be forced onto someone

test('near-miss names are suggested, not auto-picked', () => {
  const r = matchCustomer('ramesh', initialCustomers);
  assert.equal(r.best, null);
  assert.ok(r.candidates.length > 0);
});

test('two similar customers are flagged as ambiguous', () => {
  const customers = [
    { id: 'a', name: 'Sharma Ji (Gali 3)' },
    { id: 'b', name: 'Sharma Ji (Gali 7)' },
  ];
  const r = matchCustomer('Sharma ji ko 500', customers);
  assert.equal(r.best, null);
  assert.equal(r.ambiguous, true);
});
