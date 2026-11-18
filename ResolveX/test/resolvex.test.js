import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  PolicyEngine,
  CustomerTier,
  IssueSeverity,
  DiagnosisEngine,
  IncidentType,
  ResolveXAgent,
  ResolutionStatus,
  ActionType,
} from '../src/index.js';

describe('PolicyEngine', () => {
  const policy = new PolicyEngine();

  it('validates warranty correctly for active and expired dates', () => {
    const today = new Date('2026-11-18T00:00:00Z');
    
    // Active warranty (purchased 60 days ago, 365 day warranty)
    const activePurchase = new Date('2026-09-19T00:00:00Z');
    const validResult = policy.validateWarranty({
      purchaseDate: activePurchase,
      warrantyDays: 365,
      referenceDate: today,
    });
    assert.strictEqual(validResult.valid, true);
    assert.strictEqual(validResult.isExpired, false);
    assert.strictEqual(validResult.remainingDays, 305);

    // Expired warranty (purchased 400 days ago)
    const expiredPurchase = new Date('2025-10-14T00:00:00Z');
    const expiredResult = policy.validateWarranty({
      purchaseDate: expiredPurchase,
      warrantyDays: 365,
      referenceDate: today,
    });
    assert.strictEqual(expiredResult.valid, false);
    assert.strictEqual(expiredResult.isExpired, true);
  });

  it('enforces autonomous refund limits and flags high-value refunds for approval', () => {
    // Under limit ($45 <= $100)
    const safeRefund = policy.validateRefund({
      amount: 45.0,
      orderTotal: 100.0,
    });
    assert.strictEqual(safeRefund.allowedAutonomous, true);
    assert.strictEqual(safeRefund.requiresApproval, false);

    // Exceeds autonomous limit ($250 > $100)
    const highRefund = policy.validateRefund({
      amount: 250.0,
      orderTotal: 500.0,
    });
    assert.strictEqual(highRefund.allowedAutonomous, false);
    assert.strictEqual(highRefund.requiresApproval, true);
    assert.match(highRefund.reason, /exceeds autonomous refund threshold/);

    // Invalid: amount greater than order total
    const excessRefund = policy.validateRefund({
      amount: 600.0,
      orderTotal: 500.0,
    });
    assert.strictEqual(excessRefund.allowed, false);
    assert.strictEqual(excessRefund.requiresApproval, true);
  });

  it('calculates tier-adjusted apology credit correctly', () => {
    // Standard tier: 1.0x
    const standardCredit = policy.calculateApologyCredit({
      severity: IssueSeverity.MEDIUM,
      customerTier: CustomerTier.STANDARD,
    });
    assert.strictEqual(standardCredit.amount, 25.0);
    assert.strictEqual(standardCredit.multiplier, 1.0);

    // Gold tier: 1.5x
    const goldCredit = policy.calculateApologyCredit({
      severity: IssueSeverity.MEDIUM,
      customerTier: CustomerTier.GOLD,
    });
    assert.strictEqual(goldCredit.amount, 37.5);
    assert.strictEqual(goldCredit.multiplier, 1.5);

    // Platinum tier: 2.0x on High severity ($50 base)
    const platCredit = policy.calculateApologyCredit({
      severity: IssueSeverity.HIGH,
      customerTier: CustomerTier.PLATINUM,
    });
    assert.strictEqual(platCredit.amount, 100.0);
    assert.strictEqual(platCredit.multiplier, 2.0);
  });

  it('evaluates customer risk and flags abusive accounts', () => {
    const trustedCustomer = { accountAgeDays: 365, chargebackCount: 0 };
    const trustedRisk = policy.evaluateRisk({ customerProfile: trustedCustomer });
    assert.strictEqual(trustedRisk.riskLevel, 'LOW');
    assert.strictEqual(trustedRisk.allowsAutonomousAction, true);

    const flaggedCustomer = {
      accountAgeDays: 5,
      flaggedForAbuse: true,
      chargebackCount: 2,
    };
    const flaggedRisk = policy.evaluateRisk({ customerProfile: flaggedCustomer });
    assert.strictEqual(flaggedRisk.riskLevel, 'HIGH');
    assert.strictEqual(flaggedRisk.allowsAutonomousAction, false);
    assert.ok(flaggedRisk.flagExceptions.length >= 2);
  });
});

describe('DiagnosisEngine', () => {
  const diagnosisEngine = new DiagnosisEngine();

  it('classifies customer text descriptions by intent', () => {
    const text1 = 'I was charged twice on my credit card for the monthly subscription!';
    const classification1 = diagnosisEngine.classifyText(text1);
    assert.strictEqual(classification1.type, IncidentType.DOUBLE_BILLING);

    const text2 = 'My order is late, tracking is stuck for 4 days';
    const classification2 = diagnosisEngine.classifyText(text2);
    assert.strictEqual(classification2.type, IncidentType.SHIPPING_DELAY);

    const text3 = 'The headphone screen is broken and hardware won\'t turn on';
    const classification3 = diagnosisEngine.classifyText(text3);
    assert.strictEqual(classification3.type, IncidentType.PRODUCT_DEFECT);

    const text4 = 'Major service outage, 503 error, server is down';
    const classification4 = diagnosisEngine.classifyText(text4);
    assert.strictEqual(classification4.type, IncidentType.SERVICE_OUTAGE);
  });

  it('verifies double billing evidence from transaction history', () => {
    const transactions = [
      { id: 'tx-1', amount: 49.99, timestamp: '2026-11-10T10:00:00Z' },
      { id: 'tx-2', amount: 49.99, timestamp: '2026-11-10T10:04:00Z' },
    ];
    const issue = { description: 'Why am I charged twice?' };
    const result = diagnosisEngine.diagnose(issue, { transactions });

    assert.strictEqual(result.rootCause, IncidentType.DOUBLE_BILLING);
    assert.strictEqual(result.evidence.duplicateTransaction.isDuplicate, true);
    assert.strictEqual(result.evidence.duplicateTransaction.duplicateAmount, 49.99);
    assert.ok(result.confidence >= 0.95);
  });

  it('verifies shipping delay from shipment details and estimated delivery date', () => {
    const now = new Date('2026-11-18T12:00:00Z');
    const shipment = {
      trackingNumber: 'TRK-987654321',
      carrier: 'FedEx Express',
      status: 'IN_TRANSIT',
      estimatedDeliveryDate: '2026-11-14T00:00:00Z',
    };
    const issue = { description: 'Where is my order?' };
    const result = diagnosisEngine.diagnose(issue, { shipment, currentDate: now });

    assert.strictEqual(result.rootCause, IncidentType.SHIPPING_DELAY);
    assert.strictEqual(result.evidence.shipping.isDelayed, true);
    assert.strictEqual(result.evidence.shipping.daysLate, 4);
  });
});

describe('ResolveXAgent - Autonomous Resolution', () => {
  it('autonomously resolves double billing under $100 with refund and apology credit', async () => {
    const agent = new ResolveXAgent();
    const customer = {
      id: 'CUST-1001',
      name: 'Alice Johnson',
      tier: CustomerTier.SILVER,
      accountAgeDays: 200,
    };
    const order = {
      orderId: 'ORD-5501',
      total: 80.0,
      transactions: [
        { id: 'tx-001', amount: 40.0, timestamp: '2026-11-18T08:00:00Z' },
        { id: 'tx-002', amount: 40.0, timestamp: '2026-11-18T08:01:00Z' },
      ],
    };
    const issue = {
      description: 'You charged me twice for $40 each!',
      amount: 40.0,
    };

    const resolution = await agent.resolveIssue({ customer, order, issue });

    assert.strictEqual(resolution.status, ResolutionStatus.RESOLVED_AUTONOMOUSLY);
    assert.strictEqual(resolution.diagnosis.rootCause, IncidentType.DOUBLE_BILLING);
    assert.strictEqual(resolution.actionsTaken.length, 2);

    const refundAction = resolution.actionsTaken.find((a) => a.actionType === ActionType.REFUND);
    assert.ok(refundAction);
    assert.strictEqual(refundAction.outcome.amount, 40.0);
    assert.strictEqual(refundAction.outcome.success, true);

    const creditAction = resolution.actionsTaken.find((a) => a.actionType === ActionType.APOLOGY_CREDIT);
    assert.ok(creditAction);
    // Silver tier gets 1.25 multiplier on medium severity ($25 * 1.25 = $31.25)
    assert.strictEqual(creditAction.parameters.amount, 31.25);
  });

  it('autonomously resolves in-warranty defect with replacement and apology credit', async () => {
    const agent = new ResolveXAgent();
    const customer = {
      id: 'CUST-2002',
      name: 'Bob Smith',
      tier: CustomerTier.STANDARD,
      accountAgeDays: 90,
    };
    const order = {
      orderId: 'ORD-7702',
      purchaseDate: '2026-10-01T00:00:00Z',
      product: { sku: 'DEV-CAM-4K', name: 'Ultra HD Webcam', warrantyDays: 365 },
      stockAvailable: true,
    };
    const issue = {
      description: 'The webcam is defective and not working, won\'t turn on at all',
    };

    const resolution = await agent.resolveIssue({ customer, order, issue });

    assert.strictEqual(resolution.status, ResolutionStatus.RESOLVED_AUTONOMOUSLY);
    assert.strictEqual(resolution.diagnosis.rootCause, IncidentType.PRODUCT_DEFECT);

    const replacementAction = resolution.actionsTaken.find((a) => a.actionType === ActionType.REPLACEMENT);
    assert.ok(replacementAction);
    assert.strictEqual(replacementAction.outcome.success, true);
    assert.strictEqual(replacementAction.parameters.sku, 'DEV-CAM-4K');
  });

  it('autonomously handles shipping delay with priority carrier trace and loyalty credit', async () => {
    const agent = new ResolveXAgent();
    const customer = {
      id: 'CUST-3003',
      name: 'Carol White',
      tier: CustomerTier.GOLD,
      accountAgeDays: 120,
    };
    const order = {
      orderId: 'ORD-8803',
      trackingNumber: 'TRK-DHL-9911',
      carrier: 'DHL',
      shipment: {
        trackingNumber: 'TRK-DHL-9911',
        carrier: 'DHL',
        status: 'DELAYED',
        daysLate: 3,
      },
    };
    const issue = {
      description: 'My order is delayed and tracking is stuck',
    };

    const resolution = await agent.resolveIssue({ customer, order, issue });

    assert.strictEqual(resolution.status, ResolutionStatus.RESOLVED_AUTONOMOUSLY);
    assert.strictEqual(resolution.diagnosis.rootCause, IncidentType.SHIPPING_DELAY);

    const carrierAction = resolution.actionsTaken.find((a) => a.actionType === ActionType.CARRIER_INQUIRY);
    assert.ok(carrierAction);
    assert.strictEqual(carrierAction.outcome.status, 'CARRIER_NOTIFIED_PRIORITY');

    const creditAction = resolution.actionsTaken.find((a) => a.actionType === ActionType.APOLOGY_CREDIT);
    assert.ok(creditAction);
    // Gold tier gets 1.5 multiplier on medium severity ($25 * 1.5 = $37.5)
    assert.strictEqual(creditAction.parameters.amount, 37.5);
  });
});

describe('ResolveXAgent - Human-in-the-Loop Escalation & Approval', () => {
  it('escalates high-value refund ($250 > $100) to human supervisor and executes upon approval', async () => {
    const agent = new ResolveXAgent();
    const customer = {
      id: 'CUST-4004',
      name: 'David Miller',
      tier: CustomerTier.STANDARD,
      accountAgeDays: 150,
    };
    const order = {
      orderId: 'ORD-9904',
      total: 500.0,
      transactions: [
        { id: 'tx-A', amount: 250.0, timestamp: '2026-11-15T12:00:00Z' },
        { id: 'tx-B', amount: 250.0, timestamp: '2026-11-15T12:02:00Z' },
      ],
    };
    const issue = {
      description: 'I was charged twice $250 each for the yearly enterprise plan!',
      amount: 250.0,
    };

    // 1. Initial resolution attempt should escalate
    const resolution = await agent.resolveIssue({ customer, order, issue });

    assert.strictEqual(resolution.status, ResolutionStatus.REQUIRES_APPROVAL);
    assert.ok(resolution.ticketId);
    assert.match(resolution.message, /requires human agent approval/);

    // 2. Verify ticket is present in pending approvals
    const pendingList = agent.getPendingApprovals();
    assert.strictEqual(pendingList.length, 1);
    assert.strictEqual(pendingList[0].ticketId, resolution.ticketId);
    assert.strictEqual(pendingList[0].status, 'PENDING_APPROVAL');

    // 3. Human Supervisor reviews and approves
    const approvalResult = await agent.approveTicket(resolution.ticketId, {
      reviewerId: 'SUPERVISOR_SARAH',
      notes: 'Verified duplicate charge on Stripe dashboard; approved refund of $250',
    });

    assert.strictEqual(approvalResult.status, ResolutionStatus.RESOLVED_BY_APPROVAL);
    assert.strictEqual(approvalResult.reviewerId, 'SUPERVISOR_SARAH');
    assert.strictEqual(approvalResult.executedActions.length, 2);

    const executedRefund = approvalResult.executedActions.find((a) => a.actionType === ActionType.REFUND);
    assert.ok(executedRefund);
    assert.strictEqual(executedRefund.outcome.amount, 250.0);
    assert.strictEqual(executedRefund.outcome.success, true);

    // 4. Verify no pending tickets remain
    assert.strictEqual(agent.getPendingApprovals().length, 0);
  });

  it('handles human supervisor rejection with alternative credit offer', async () => {
    const agent = new ResolveXAgent();
    const customer = {
      id: 'CUST-5005',
      name: 'Eva Green',
      tier: CustomerTier.STANDARD,
      accountAgeDays: 20,
    };
    const order = {
      orderId: 'ORD-9905',
      total: 300.0,
      purchaseDate: '2025-01-01T00:00:00Z', // Expired warranty
      product: { name: 'Vintage Camera', warrantyDays: 90 },
    };
    const issue = {
      description: 'The camera lens stopped focusing, I demand a full refund of $300',
      requestedAction: ActionType.REFUND,
      amount: 300.0,
    };

    const resolution = await agent.resolveIssue({ customer, order, issue });
    assert.strictEqual(resolution.status, ResolutionStatus.REQUIRES_APPROVAL);

    // Reviewer rejects cash refund but grants customer $50 courtesy voucher
    const rejectionResult = await agent.rejectTicket(resolution.ticketId, {
      reviewerId: 'SUPERVISOR_MIKE',
      reason: 'Product is 1.5 years out of warranty; refund denied',
      alternativeAction: {
        type: ActionType.APOLOGY_CREDIT,
        amount: 50.0,
        currency: 'USD',
        breakdown: 'Courtesy store voucher for out-of-warranty customer',
      },
    });

    assert.strictEqual(rejectionResult.status, ResolutionStatus.REJECTED_BY_REVIEWER);
    assert.strictEqual(rejectionResult.reason, 'Product is 1.5 years out of warranty; refund denied');
    assert.ok(rejectionResult.alternativeResult);
    assert.strictEqual(rejectionResult.alternativeResult[0].parameters.amount, 50.0);
  });
});

describe('Audit Logging', () => {
  it('maintains comprehensive audit trail of all ingestion, decisions, and approvals', async () => {
    const agent = new ResolveXAgent();
    const customer = { id: 'CUST-6006', name: 'Frank', tier: CustomerTier.PLATINUM };
    const order = {
      total: 500,
      transactions: [
        { id: 'tx-1', amount: 300, timestamp: '2026-11-18T10:00:00Z' },
        { id: 'tx-2', amount: 300, timestamp: '2026-11-18T10:01:00Z' },
      ],
    };
    const issue = { description: 'Duplicate charge of $300', amount: 300 };

    const resolution = await agent.resolveIssue({ customer, order, issue });
    await agent.approveTicket(resolution.ticketId, { reviewerId: 'MANAGER_ALEX' });

    const auditTrail = agent.getAuditLog({ caseId: resolution.caseId });
    assert.ok(auditTrail.length >= 4);

    const stages = auditTrail.map((entry) => entry.stage);
    assert.ok(stages.includes('INGESTION'));
    assert.ok(stages.includes('DIAGNOSIS'));
    assert.ok(stages.includes('POLICY_EVALUATION'));
    assert.ok(stages.includes('ESCALATION'));
    assert.ok(stages.includes('HUMAN_IN_THE_LOOP'));

    // Check structure of audit records
    for (const record of auditTrail) {
      assert.ok(record.id);
      assert.ok(record.timestamp);
      assert.ok(record.actor);
      assert.ok(record.action);
    }
  });
});

describe('ResolveX Security - Idempotency & Replay Protection', () => {
  it('blocks duplicate refund replays against the same transaction ID', async () => {
    const agent = new ResolveXAgent();
    const customer = { id: 'CUST-SEC-1', name: 'Alice Security' };
    const order = { id: 'ORD-SEC-1' };
    const issue = { caseId: 'CASE-REPLAY-1', subject: 'I was charged twice', description: 'Charged two times' };
    const context = {
      transactions: [
        { id: 'TX-DUP-1', amount: 45, date: new Date('2026-11-01T10:00:00Z') },
        { id: 'TX-DUP-1', amount: 45, date: new Date('2026-11-01T10:01:00Z') },
      ],
    };

    // First execution succeeds
    const firstRes = await agent.resolveIssue({ customer, order, issue, context });
    assert.equal(firstRes.status, 'RESOLVED_AUTONOMOUSLY');

    // Attempting replay with identical actions blocks double refund
    const replayRes = await agent._executeActions([
      { type: 'REFUND', amount: 45, targetTxId: 'TX-DUP-1' }
    ], { customer, order, caseId: 'CASE-REPLAY-1' });

    assert.equal(replayRes[0].outcome.status, 'DUPLICATE_IDEMPOTENT_IGNORED');
  });
});
