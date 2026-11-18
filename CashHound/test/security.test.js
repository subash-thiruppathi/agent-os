import test from 'node:test';
import assert from 'node:assert/strict';
import { Invoice, generateDunningMessage, calculateInstallmentPlan } from '../src/index.js';

test('CashHound Security: sanitizes URL parameters in dunning links and blocks insecure schemes', () => {
  const inv = new Invoice({
    id: 'INV#1001&attacker=evil.com',
    customer: { name: 'Acme Test' },
    amount: 1500,
    dueDate: '2026-11-01'
  });

  const msg = generateDunningMessage(inv);
  assert.ok(msg.paymentLink.includes('INV%231001%26attacker%3Devil.com'));
  assert.ok(!msg.paymentLink.includes('INV#1001'));

  // Insecure http scheme should be rejected
  assert.throws(() => {
    generateDunningMessage(inv, { paymentPortalUrl: 'http://insecure-portal.com' });
  }, /HTTPS required/);
});

test('CashHound Security: enforces positive finite balance bounds on installment plans', () => {
  assert.throws(() => {
    calculateInstallmentPlan(-100);
  }, /positive finite number/);

  assert.throws(() => {
    calculateInstallmentPlan(NaN);
  }, /positive finite number/);

  assert.throws(() => {
    calculateInstallmentPlan(Infinity);
  }, /positive finite number/);
});
