import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReminderMessage, createUpiUri, createWhatsAppUrl, isValidUpiId } from '../src/lib/reminders';

const langs = ['hinglish', 'hindi', 'english'] as const;
const tones = ['polite', 'friendly', 'firm'] as const;

test('reminder contains amount, shop name and UPI link only — never customer name or phone', () => {
  for (const language of langs) {
    for (const tone of tones) {
      const msg = buildReminderMessage({ amountPaise: 125000, shopName: 'Gupta Kirana', upiId: 'gupta@okaxis', language, tone });
      assert.ok(msg.includes('₹1,250'), `${language}/${tone} amount`);
      assert.ok(msg.includes('Gupta Kirana'), `${language}/${tone} shop`);
      assert.ok(msg.includes('upi://pay?pa=gupta@okaxis&pn=Gupta%20Kirana&am=1250&cu=INR'), `${language}/${tone} link`);
      assert.ok(!/\d{10}/.test(msg), 'no phone numbers');
    }
  }
});

test('UPI link uses rupee amount with paise when needed', () => {
  assert.match(createUpiUri('a@ybl', 'Shop', 9950), /am=99\.50&/);
});

test('WhatsApp links: valid Indian mobiles only, text prefilled, nothing sent', () => {
  assert.equal(createWhatsAppUrl('98712 34501', 'hi'), 'https://wa.me/919871234501?text=hi');
  assert.equal(createWhatsAppUrl('+91 9871234501', 'hi'), 'https://wa.me/919871234501?text=hi');
  assert.equal(createWhatsAppUrl('', 'hi'), null);
  assert.equal(createWhatsAppUrl('12345', 'hi'), null);
  assert.equal(createWhatsAppUrl('1234567890', 'hi'), null); // Indian mobiles start with 6-9
});

test('UPI id validation', () => {
  assert.equal(isValidUpiId('guptakirana@okaxis'), true);
  assert.equal(isValidUpiId('9811234567@ybl'), true);
  assert.equal(isValidUpiId('not-an-upi'), false);
  assert.equal(isValidUpiId(''), false);
});
