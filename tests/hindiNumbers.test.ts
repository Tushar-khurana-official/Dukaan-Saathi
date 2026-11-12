import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHindiAmount } from '../src/lib/hindiNumbers';

const cases: Array<[string, number | null]> = [
  ['paanch sau', 500],
  ['Sharma ji ko paanch sau udhaar', 500],
  ['dedh sau', 150],
  ['dhai sau', 250],
  ['dedh hazaar', 1500],
  ['dhai hazaar', 2500],
  ['saade teen sau', 350],
  ['sawa sau', 125],
  ['paune do sau', 175],
  ['ek sau pachaas', 150],
  ['do hazaar paanch sau', 2500],
  ['ek lakh pachaas hazaar', 150000],
  ['five hundred rupees', 500],
  ['₹1,200', 1200],
  ['Rs. 450', 450],
  ['500/-', 500],
  ['1.5k', 1500],
  ['पाँच सौ उधार', 500],
  ['डेढ़ हज़ार', 1500],
  ['साढ़े चार सौ', 450],
  ['२५०', 250],
  ['2 kilo atta 120 ka', 120], // quantity is not money
  ['ek baar 500 diye', 500], // "ek baar" = once
  ['Sharma ji ke saath 300', 300], // "saath" = with, not 60
  ['de do', null],
  ['phone 9876543210', null], // phone numbers are never amounts
  ['das rupaye', 10],
];

for (const [text, expected] of cases) {
  test(`amount: "${text}" -> ${expected}`, () => {
    assert.equal(parseHindiAmount(text), expected);
  });
}
