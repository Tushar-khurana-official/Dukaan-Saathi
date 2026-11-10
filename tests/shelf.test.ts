import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareScans, sanitizeDetections, stripUnitCounts } from '../src/lib/shelf';
import { initialPastScans } from '../src/utils/seedData';

const COUNT = /\b\d+\s*(units?|packets?|packs?|pkts?|pouch(es)?|bottles?|pieces?|pcs)\b/i;

test('acceptance: shelf results never show exact unit counts', () => {
  const raw = [
    { name: 'Maggi', matched_sku: 'maggi-70g', status: 'low', confidence: 0.9, note: 'Only 3 units visible' },
    { name: 'Salt', matched_sku: null, status: 'out', confidence: 0.9, note: 'sirf 2 packet bache hain' },
    { name: 'Oil', matched_sku: null, status: 'low', confidence: 0.9, note: 'ab sirf 1 pouch bacha hai' },
    { name: 'Tea', matched_sku: null, status: 'ok', confidence: 0.9, note: 'Front row mein sirf 2 bache hain' },
    { name: 'Soap', matched_sku: null, status: 'weird', confidence: 7, note: 'count: 12' },
  ];
  const clean = sanitizeDetections(raw);
  for (const d of clean) {
    assert.ok(!COUNT.test(d.note), d.note);
    assert.ok(!/\b\d+\s+(bache|left|visible)\b/i.test(d.note), d.note);
    assert.ok(!/count\s*:\s*\d/i.test(d.note), d.note);
  }
  assert.equal(clean[4].status, 'unknown');
  assert.equal(clean[4].confidence, 1);
});

test('product sizes in names are kept ("Maggi 70g", "Oil 1L")', () => {
  assert.equal(stripUnitCounts('Maggi 70g pack'), 'Maggi 70g pack');
  assert.equal(stripUnitCounts('Fortune Oil 1L'), 'Fortune Oil 1L');
});

test('seed scan notes contain no counts', () => {
  for (const scan of initialPastScans) {
    assert.ok(!COUNT.test(scan.overall_notes), scan.overall_notes);
    for (const d of scan.detected_items) assert.ok(!COUNT.test(d.note), d.note);
  }
});

test('scan comparison finds what got worse', () => {
  const prev = sanitizeDetections([{ name: 'Maggi', matched_sku: 'm', status: 'ok', confidence: 1, note: '' }]);
  const cur = sanitizeDetections([{ name: 'Maggi', matched_sku: 'm', status: 'low', confidence: 1, note: '' }]);
  assert.equal(compareScans(cur, prev)[0].trend, 'worse');
  assert.equal(compareScans(cur, null)[0].trend, 'new');
});
