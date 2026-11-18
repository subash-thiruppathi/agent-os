import test from 'node:test';
import assert from 'node:assert/strict';
import { settlementAgent, SettlementReconciler } from '../src/index.js';

test('Clerk: blocks settlement if charges differ from accepted estimate', () => {
  const jobMismatched = {
    input: { amount: 150000 },
    report: { amount: 200000 }
  };
  const decision = settlementAgent.next(jobMismatched);
  assert.equal(decision.wait, 'blocked');
  assert.match(decision.reason, /charges differ/);
});

test('Clerk: proposes invoice and payment verification when charges agree', () => {
  const jobStandard = {
    input: { amount: 150000 },
    report: { amount: 150000, warranty: false }
  };
  const decision1 = settlementAgent.next(jobStandard);
  assert.equal(decision1.tool, 'invoice');
  assert.equal(decision1.permission, 'invoice');

  const decision2 = settlementAgent.next({ ...jobStandard, invoice: { id: 'inv-1', amount: 150000 } });
  assert.equal(decision2.tool, 'verifyPayment');
});

test('Clerk: payment reconciliation confirms exact amount and invoice binding', () => {
  const reconciler = new SettlementReconciler();
  const invoice = reconciler.issueInvoice('t1', 'job-1', 150000, 'INR');

  // Mismatched amount
  reconciler.recordPayment('t1', 'job-1', invoice.id, 100000, 'INR', 'ref-01');
  assert.equal(reconciler.verifyPayment('t1', 'job-1').verified, false);

  // Exact match
  reconciler.recordPayment('t1', 'job-1', invoice.id, 150000, 'INR', 'ref-02');
  assert.equal(reconciler.verifyPayment('t1', 'job-1').verified, true);
});
