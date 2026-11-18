/**
 * CashHound Comprehensive Automated Unit Tests
 * Uses Node.js built-in `node:test` and `node:assert`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Invoice,
  AgingBuckets,
  InvoiceStatus,
  CustomerTier,
  PriorityLevel,
  DunningTier,
  DunningTone,
  generateDunningMessage,
  calculateInstallmentPlan,
  calculateSettlementOffer,
  CashHoundAgent,
  ActionStatus,
  AgentDecisionType,
} from '../src/index.js';

describe('Invoice Model & Aging Classification', () => {
  const asOf = new Date('2026-11-15T00:00:00Z');

  it('correctly models invoice properties and calculates initial balance', () => {
    const inv = new Invoice({
      id: 'INV-101',
      customer: { name: 'Acme Corp', email: 'billing@acme.com' },
      amount: 1500,
      dueDate: '2026-11-01',
    });

    assert.equal(inv.id, 'INV-101');
    assert.equal(inv.amount, 1500);
    assert.equal(inv.amountPaid, 0);
    assert.equal(inv.balance, 1500);
    assert.equal(inv.status, InvoiceStatus.ISSUED);
    assert.equal(inv.customer.tier, CustomerTier.STANDARD);
  });

  it('classifies aging into current bucket when not yet overdue', () => {
    const inv = new Invoice({
      id: 'INV-CURR',
      customer: { name: 'Alpha Ltd' },
      amount: 800,
      dueDate: '2026-11-20',
    });

    const days = inv.getDaysPastDue(asOf);
    assert.ok(days < 0, `Expected negative days, got ${days}`);
    assert.equal(inv.getAgingBucket(asOf), AgingBuckets.CURRENT);
  });

  it('classifies aging into 30+ bucket (1-30 days past due)', () => {
    const inv = new Invoice({
      id: 'INV-30',
      customer: { name: 'Beta LLC' },
      amount: 1200,
      dueDate: '2026-10-31', // 15 days overdue
    });

    const days = inv.getDaysPastDue(asOf);
    assert.equal(days, 15);
    assert.equal(inv.getAgingBucket(asOf), AgingBuckets.DAYS_30);
  });

  it('classifies aging into 60+ bucket (31-60 days past due)', () => {
    const inv = new Invoice({
      id: 'INV-60',
      customer: { name: 'Gamma Inc' },
      amount: 2500,
      dueDate: '2026-09-30', // 46 days overdue
    });

    const days = inv.getDaysPastDue(asOf);
    assert.ok(days >= 31 && days <= 60);
    assert.equal(inv.getAgingBucket(asOf), AgingBuckets.DAYS_60);
  });

  it('classifies aging into 90+ bucket (61+ days past due)', () => {
    const inv = new Invoice({
      id: 'INV-90',
      customer: { name: 'Delta Co' },
      amount: 3200,
      dueDate: '2026-08-01', // > 100 days overdue
    });

    const days = inv.getDaysPastDue(asOf);
    assert.ok(days > 60);
    assert.equal(inv.getAgingBucket(asOf), AgingBuckets.DAYS_90);
  });

  it('handles dispute lifecycle: mark disputed and resolve dispute', () => {
    const inv = new Invoice({
      id: 'INV-DISP',
      customer: { name: 'Omega Tech' },
      amount: 2000,
      dueDate: '2026-10-15',
    });

    assert.equal(inv.isDisputed(), false);
    assert.equal(inv.isLegalDispute(), false);

    inv.markDisputed({
      reason: 'Billing hours discrepancy in phase 2',
      isLegal: false,
      notes: 'Customer queried 10 hours',
    });

    assert.equal(inv.isDisputed(), true);
    assert.equal(inv.isLegalDispute(), false);
    assert.equal(inv.status, InvoiceStatus.DISPUTED);

    inv.resolveDispute({
      resolution: 'Credit memo issued for 5 hours; balance agreed',
      notes: 'Customer agreed to pay remainder',
    });

    assert.equal(inv.isDisputed(), false);
    assert.equal(inv.status, InvoiceStatus.ISSUED);
    assert.equal(inv.dispute.status, 'resolved');
  });

  it('flags legal disputes accurately', () => {
    const inv = new Invoice({
      id: 'INV-LEGAL',
      customer: { name: 'Zeta Corp' },
      amount: 15000,
      dueDate: '2026-08-15',
    });

    inv.markDisputed({
      reason: 'Notice of litigation received from outside counsel',
      isLegal: true,
      notes: 'Legal counsel involved',
    });

    assert.equal(inv.isLegalDispute(), true);
  });

  it('calculates dynamic recovery priority score and level', () => {
    const oldHighVal = new Invoice({
      id: 'INV-HI-PRIO',
      customer: { name: 'BigCorp', tier: CustomerTier.STANDARD },
      amount: 12000,
      dueDate: '2026-08-01', // 90+ bucket
    });

    const prio = oldHighVal.calculatePriority(asOf);
    assert.ok(prio.score >= 80, `Expected score >= 80, got ${prio.score}`);
    assert.equal(prio.level, PriorityLevel.CRITICAL);
    assert.ok(prio.reasons.length > 0);

    const paidInv = new Invoice({
      id: 'INV-PAID',
      customer: { name: 'GoodClient' },
      amount: 500,
      amountPaid: 500,
      dueDate: '2026-11-01',
    });

    const paidPrio = paidInv.calculatePriority(asOf);
    assert.equal(paidPrio.score, 0);
    assert.equal(paidPrio.level, PriorityLevel.LOW);
  });
});

describe('Dunning Engine & Financial Calculators', () => {
  const invoice = new Invoice({
    id: 'INV-202',
    customer: { name: 'Starlight Studios', email: 'ap@starlight.com', tier: CustomerTier.STANDARD },
    amount: 3000,
    dueDate: '2026-10-15',
  });
  const asOf = new Date('2026-11-15T00:00:00Z'); // 31 days overdue

  it('generates polite Tier 1 courtesy notice for early overdue', () => {
    const msg = generateDunningMessage(invoice, {
      tier: DunningTier.TIER_1_COURTESY,
      asOfDate: asOf,
    });

    assert.equal(msg.tier, DunningTier.TIER_1_COURTESY);
    assert.equal(msg.tone, DunningTone.FRIENDLY);
    assert.match(msg.subject, /Friendly reminder/);
    assert.match(msg.body, /disregard this note/);
    assert.ok(msg.paymentLink.includes('INV-202'));
  });

  it('generates firm Tier 3 urgent notice for 30+ days overdue', () => {
    const msg = generateDunningMessage(invoice, {
      tier: DunningTier.TIER_3_URGENT,
      asOfDate: asOf,
    });

    assert.equal(msg.tier, DunningTier.TIER_3_URGENT);
    assert.equal(msg.tone, DunningTone.URGENT);
    assert.match(msg.subject, /Urgent:/);
    assert.match(msg.body, /uninterrupted service/);
    assert.ok(msg.installmentPlan);
  });

  it('generates Tier 4 final demand with settlement offer for severe delinquency', () => {
    const msg = generateDunningMessage(invoice, {
      tier: DunningTier.TIER_4_FINAL_DEMAND,
      asOfDate: asOf,
    });

    assert.equal(msg.tier, DunningTier.TIER_4_FINAL_DEMAND);
    assert.equal(msg.tone, DunningTone.FORMAL);
    assert.match(msg.subject, /FINAL DEMAND:/);
    assert.match(msg.body, /legal recovery/);
    assert.ok(msg.settlementOffer);
    assert.match(msg.settlementOffer.terms, /settle invoice in full/);
  });

  it('protects VIP customer relationships with empathetic tone', () => {
    const vipInvoice = new Invoice({
      id: 'INV-VIP',
      customer: { name: 'Key Partner Enterprise', tier: CustomerTier.VIP },
      amount: 4000,
      dueDate: '2026-10-15',
    });

    const msg = generateDunningMessage(vipInvoice, {
      tier: DunningTier.TIER_2_REMINDER,
      asOfDate: asOf,
    });

    assert.equal(msg.tone, DunningTone.EMPATHETIC);
    assert.match(msg.body, /value our partnership/);
  });

  it('calculates installment payment plans accurately', () => {
    const plan = calculateInstallmentPlan(1200, {
      numberOfInstallments: 3,
      frequency: 'monthly',
      startDate: '2026-11-20',
    });

    assert.equal(plan.originalBalance, 1200);
    assert.equal(plan.totalPayable, 1200);
    assert.equal(plan.numberOfInstallments, 3);
    assert.equal(plan.schedule.length, 3);
    assert.equal(plan.schedule[0].amount, 400);
    assert.equal(plan.schedule[1].amount, 400);
    assert.equal(plan.schedule[2].amount, 400);
    assert.equal(plan.schedule[2].remainingBalanceAfter, 0);
  });

  it('calculates lump-sum settlement discount offers', () => {
    const offer = calculateSettlementOffer(2000, {
      discountPercentage: 20,
      validityDays: 10,
      asOfDate: '2026-11-15',
    });

    assert.equal(offer.originalBalance, 2000);
    assert.equal(offer.discountPercentage, 20);
    assert.equal(offer.discountAmount, 400);
    assert.equal(offer.settlementAmount, 1600);
    assert.equal(offer.validUntil, '2026-11-25');
  });
});

describe('CashHound Decision State Machine & Approval Gates', () => {
  const asOf = new Date('2026-11-15T00:00:00Z');

  it('automatically dispatches safe reminders for low-risk accounts (<$5000)', () => {
    const agent = new CashHoundAgent({
      highValueThreshold: 5000,
      autoSendSafeReminders: true,
    });

    const safeInv = new Invoice({
      id: 'INV-SAFE-01',
      customer: { name: 'Small Shop LLC', email: 'owner@smallshop.com' },
      amount: 1200,
      dueDate: '2026-11-01', // 14 days overdue
    });
    agent.registerInvoice(safeInv);

    const result = agent.processInvoice(safeInv, asOf);

    assert.equal(result.status, ActionStatus.AUTO_EXECUTED);
    assert.equal(result.decision, AgentDecisionType.SAFE_REMINDER);
    assert.equal(safeInv.communications.length, 1);
    assert.equal(safeInv.communications[0].status, 'sent');
  });

  it('flags high-value invoices (>=$5,000) for human approval before sending', () => {
    const agent = new CashHoundAgent({
      highValueThreshold: 5000,
    });

    const highValInv = new Invoice({
      id: 'INV-HIGH-VAL',
      customer: { name: 'MegaCorp Enterprises' },
      amount: 7500,
      dueDate: '2026-11-01', // 14 days overdue
    });
    agent.registerInvoice(highValInv);

    const result = agent.processInvoice(highValInv, asOf);

    assert.equal(result.status, ActionStatus.PENDING_APPROVAL);
    assert.equal(result.decision, AgentDecisionType.REQUIRE_APPROVAL);
    assert.ok(result.approvalReasons.some(r => r.includes('High-value invoice balance')));
    // Must NOT have dispatched communication yet
    assert.equal(highValInv.communications.length, 0);

    // Verify it appears in pending approvals queue
    const pending = agent.getPendingApprovals();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, result.id);
  });

  it('flags legal dispute accounts for human approval', () => {
    const agent = new CashHoundAgent();

    const legalInv = new Invoice({
      id: 'INV-LEGAL-GATE',
      customer: { name: 'Disputed Corp' },
      amount: 3000, // < 5000, but legal dispute
      dueDate: '2026-10-01',
    });
    legalInv.markDisputed({
      reason: 'Attorney letter received contesting deliverable',
      isLegal: true,
    });
    agent.registerInvoice(legalInv);

    const result = agent.processInvoice(legalInv, asOf);

    assert.equal(result.status, ActionStatus.PENDING_APPROVAL);
    assert.ok(result.approvalReasons.some(r => r.includes('Active legal dispute')));
    assert.equal(legalInv.communications.length, 0);
  });

  it('enforces communication cooldown window to avoid customer spam', () => {
    const agent = new CashHoundAgent({ cooldownDays: 7 });

    const inv = new Invoice({
      id: 'INV-COOLDOWN',
      customer: { name: 'Fresh Start LLC' },
      amount: 800,
      dueDate: '2026-11-01',
    });
    agent.registerInvoice(inv);

    // First reminder is sent
    const res1 = agent.processInvoice(inv, asOf);
    assert.equal(res1.status, ActionStatus.AUTO_EXECUTED);

    // Next day inquiry
    const nextDay = new Date('2026-11-16T00:00:00Z');
    const res2 = agent.processInvoice(inv, nextDay);
    assert.equal(res2.decision, AgentDecisionType.NO_ACTION);
    assert.match(res2.reason, /cooldown window/);
  });

  it('allows human operator to approve pending actions', () => {
    const agent = new CashHoundAgent({ highValueThreshold: 5000 });

    const inv = new Invoice({
      id: 'INV-APPROVE-TEST',
      customer: { name: 'Enterprise Co' },
      amount: 6000,
      dueDate: '2026-11-01',
    });
    agent.registerInvoice(inv);

    const action = agent.processInvoice(inv, asOf);
    assert.equal(action.status, ActionStatus.PENDING_APPROVAL);

    const executed = agent.approveAction(action.id, {
      name: 'Sarah Controller',
      email: 'sarah@company.com',
      notes: 'Reviewed with account manager, safe to send',
    });

    assert.equal(executed.status, ActionStatus.APPROVED);
    assert.equal(inv.communications.length, 1);
    assert.equal(inv.communications[0].status, 'sent');
    assert.equal(agent.getPendingApprovals().length, 0);
  });

  it('allows human operator to reject pending actions with feedback', () => {
    const agent = new CashHoundAgent({ highValueThreshold: 5000 });

    const inv = new Invoice({
      id: 'INV-REJECT-TEST',
      customer: { name: 'Tech Partner' },
      amount: 9000,
      dueDate: '2026-11-01',
    });
    agent.registerInvoice(inv);

    const action = agent.processInvoice(inv, asOf);
    assert.equal(action.status, ActionStatus.PENDING_APPROVAL);

    const rejected = agent.rejectAction(action.id, 'Holding reminder pending contract renewal discussion');

    assert.equal(rejected.status, ActionStatus.REJECTED);
    assert.equal(rejected.rejectedBy.reason, 'Holding reminder pending contract renewal discussion');
    assert.equal(inv.communications.length, 0);
  });
});

describe('Payment Reconciliation & Full Batch Cycle', () => {
  const asOf = new Date('2026-11-15T00:00:00Z');

  it('reconciles partial payment, updates balance, and cancels pending dunning actions', () => {
    const agent = new CashHoundAgent({ highValueThreshold: 5000 });

    const inv = new Invoice({
      id: 'INV-RECON-01',
      customer: { name: 'Apex Builders' },
      amount: 8000,
      dueDate: '2026-10-15',
    });
    agent.registerInvoice(inv);

    // Creates pending action due to high value
    const pendingAction = agent.processInvoice(inv, asOf);
    assert.equal(pendingAction.status, ActionStatus.PENDING_APPROVAL);

    // Customer sends partial wire payment of $5,000
    const recon = agent.recordPayment('INV-RECON-01', {
      amount: 5000,
      method: 'wire',
      reference: 'WIRE-998822',
      date: asOf,
    });

    assert.equal(recon.initialBalance, 8000);
    assert.equal(recon.amountPaid, 5000);
    assert.equal(recon.remainingBalance, 3000);
    assert.equal(recon.isFullyPaid, false);
    assert.equal(inv.status, InvoiceStatus.PARTIALLY_PAID);

    // Assert pending action was automatically cancelled
    assert.ok(recon.cancelledActions.includes(pendingAction.id));
    assert.equal(pendingAction.status, ActionStatus.CANCELLED);

    // Verify receipt acknowledgment communication
    assert.ok(recon.receiptCommunication);
    assert.match(recon.receiptCommunication.subject, /Payment Received/);
  });

  it('reconciles full payment and marks invoice fully paid', () => {
    const agent = new CashHoundAgent();

    const inv = new Invoice({
      id: 'INV-RECON-FULL',
      customer: { name: 'Zenith Retail' },
      amount: 1500,
      dueDate: '2026-10-20',
    });
    agent.registerInvoice(inv);

    const recon = agent.recordPayment('INV-RECON-FULL', {
      amount: 1500,
      method: 'ach',
      reference: 'ACH-112233',
    });

    assert.equal(recon.remainingBalance, 0);
    assert.equal(recon.isFullyPaid, true);
    assert.equal(inv.status, InvoiceStatus.PAID);
  });

  it('executes a complete batch cycle over an entire invoice portfolio', () => {
    const agent = new CashHoundAgent({
      highValueThreshold: 5000,
    });

    // 1. Current invoice
    agent.registerInvoice(new Invoice({
      id: 'INV-PORT-1',
      customer: { name: 'Customer 1' },
      amount: 1000,
      dueDate: '2026-11-25', // current
    }));

    // 2. Safe overdue invoice (< $5000)
    agent.registerInvoice(new Invoice({
      id: 'INV-PORT-2',
      customer: { name: 'Customer 2' },
      amount: 1500,
      dueDate: '2026-11-01', // 30+ days bucket
    }));

    // 3. High value overdue invoice (>= $5000)
    agent.registerInvoice(new Invoice({
      id: 'INV-PORT-3',
      customer: { name: 'Customer 3' },
      amount: 8500,
      dueDate: '2026-10-15', // 60+ days bucket, high value
    }));

    // 4. Overdue invoice with legal dispute
    const legalInv = new Invoice({
      id: 'INV-PORT-4',
      customer: { name: 'Customer 4' },
      amount: 2200,
      dueDate: '2026-09-01', // 90+ days
    });
    legalInv.markDisputed({ reason: 'Legal claim filed', isLegal: true });
    agent.registerInvoice(legalInv);

    const report = agent.runCycle(asOf);

    assert.equal(report.totalInvoices, 4);
    assert.equal(report.totalOutstandingBalance, 13200);
    assert.equal(report.actionsAutoSent, 1); // Customer 2 safe auto reminder
    assert.equal(report.actionsFlaggedForApproval, 2); // Customer 3 (high value) & Customer 4 (legal)
    assert.equal(report.noActionCount, 1); // Customer 1 (current)
    assert.equal(report.flaggedHighValueCount, 1);
    assert.equal(report.legalDisputeCount, 1);

    // Audit trail verification
    const auditLogs = agent.getAuditLog();
    assert.ok(auditLogs.length > 5);
    assert.ok(auditLogs.some(l => l.eventType === 'CYCLE_COMPLETED'));
  });
});
