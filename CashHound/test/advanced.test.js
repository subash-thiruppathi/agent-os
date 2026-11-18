import test from 'node:test';
import assert from 'node:assert/strict';
import { CashHoundAgent, Invoice, SettlementNpvOptimizer, BankFeedReconciler } from '../src/index.js';

test('CashHound NPV Optimizer: evaluates recovery probabilities and discount advantages', () => {
  const optimizer = new SettlementNpvOptimizer(0.10);

  // Severe overdue (90+ days) for high risk customer
  const plan = optimizer.calculateOptimalSettlement(10000, 95, 'HIGH_RISK');
  assert.equal(plan.agingBucket, '90+');
  assert.equal(plan.recommendedDiscountPercent, 30); // 25 + 5
  assert.equal(plan.settlementCashToday, 7000);
  assert.equal(plan.shouldOfferSettlement, true);
  assert.ok(plan.netRecoveryAdvantage > 0);
});

test('CashHound Bank Reconciler: auto-matches ACH memo, settles invoice, and terminates dunning', () => {
  const agent = new CashHoundAgent();
  const inv = new Invoice({
    id: 'INV-1094',
    customer: { name: 'Acme Logistics' },
    amount: 5000,
    dueDate: '2026-10-01'
  });
  agent.registerInvoice(inv);
  agent.runCycle('2026-11-15T00:00:00Z');

  assert.equal(agent.getPendingApprovals().length, 1);

  const reconciler = new BankFeedReconciler(agent);
  const webhook = {
    amount: 5000,
    memo: 'Wire transfer payment for INV-1094 ref #9923',
    sender: 'Acme Logistics'
  };

  const receipt = reconciler.processWebhookEvent(webhook);
  assert.equal(receipt.matched, true);
  assert.equal(receipt.isFullyPaid, true);
  assert.equal(inv.balance, 0);

  // Pending dunning actions must now be empty
  assert.equal(agent.getPendingApprovals().length, 0);
});
