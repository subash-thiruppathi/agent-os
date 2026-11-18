import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeculativeVerifier } from '../src/speculative-verifier.js';

test('SpeculativeVerifier: verifies math breakdown reconciliation and approves valid action', () => {
  const verifier = new SpeculativeVerifier();
  const validAction = {
    id: 'act-refund-valid',
    title: 'Customer Refund Approval',
    amountCents: 15000,
    breakdown: [
      { label: 'Item refund', amountCents: 12000 },
      { label: 'Tax adjustment', amountCents: 3000 }
    ],
    messageBody: 'We have approved your refund of $150.00.'
  };

  const audit = verifier.verifyAction(validAction);
  assert.equal(audit.verified, true);
  assert.equal(audit.policyAlignmentScore, 100);
  assert.equal(audit.issues.length, 0);
});

test('SpeculativeVerifier: rejects actions with math discrepancies and prohibited coercion language', () => {
  const verifier = new SpeculativeVerifier();

  // Test 1: Math breakdown mismatch
  const badMathAction = {
    id: 'act-math-fail',
    amountCents: 20000,
    breakdown: [
      { label: 'Part A', amountCents: 10000 },
      { label: 'Part B', amountCents: 5000 } // Sum = 15000 != 20000
    ]
  };
  const mathAudit = verifier.verifyAction(badMathAction);
  assert.equal(mathAudit.verified, false);
  assert.ok(mathAudit.issues.some(i => i.includes('Math Discrepancy')));

  // Test 2: Prohibited coercion phrase
  const coerciveAction = {
    id: 'act-coercion-fail',
    amountCents: 5000,
    messageBody: 'Pay your overdue invoice immediately or we will report you to the police.'
  };
  const coercionAudit = verifier.verifyAction(coerciveAction);
  assert.equal(coercionAudit.verified, false);
  assert.ok(coercionAudit.issues.some(i => i.includes('Coercive/prohibited debt collection phrase')));
});
