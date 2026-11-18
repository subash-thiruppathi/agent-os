/**
 * CashHound - Autonomous Decision State Machine
 * Evaluates receivables, enforces risk and governance policies,
 * flags high-value and legal accounts for human approval,
 * and automates safe dunning and payment reconciliation.
 */

import { Invoice, InvoiceStatus, AgingBuckets, PriorityLevel } from './invoice.js';
import { generateDunningMessage, DunningTier } from './dunning.js';

export const ActionStatus = Object.freeze({
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  AUTO_EXECUTED: 'AUTO_EXECUTED',
  CANCELLED: 'CANCELLED',
});

export const AgentDecisionType = Object.freeze({
  NO_ACTION: 'NO_ACTION',
  SAFE_REMINDER: 'SAFE_REMINDER',
  REQUIRE_APPROVAL: 'REQUIRE_APPROVAL',
  DISPUTE_REVIEW: 'DISPUTE_REVIEW',
  PAYMENT_RECONCILIATION: 'PAYMENT_RECONCILIATION',
});

export class CashHoundAgent {
  /**
   * @param {Object} [config={}]
   * @param {number} [config.highValueThreshold=5000] - Invoices >= this amount require human approval
   * @param {number} [config.cooldownDays=7] - Minimum days between reminders
   * @param {boolean} [config.autoSendSafeReminders=true] - Whether to auto-send low-risk reminders
   * @param {boolean} [config.requireApprovalForFinalDemand=true] - Tier 4 always needs human approval
   * @param {string} [config.agentName='CashHound']
   */
  constructor(config = {}) {
    this.agentName = config.agentName || 'CashHound';
    this.highValueThreshold = typeof config.highValueThreshold === 'number' ? config.highValueThreshold : 5000;
    this.cooldownDays = typeof config.cooldownDays === 'number' ? config.cooldownDays : 7;
    this.autoSendSafeReminders = config.autoSendSafeReminders !== false;
    this.requireApprovalForFinalDemand = config.requireApprovalForFinalDemand !== false;

    /** @type {Map<string, Invoice>} */
    this.invoices = new Map();

    /** @type {Map<string, Object>} */
    this.actions = new Map();

    /** @type {Array<Object>} */
    this.auditTrail = [];
  }

  /**
   * Registers an invoice with the CashHound agent.
   * @param {Invoice} invoice
   * @returns {Invoice}
   */
  registerInvoice(invoice) {
    if (!(invoice instanceof Invoice)) {
      throw new Error('Expected an instance of Invoice');
    }
    this.invoices.set(invoice.id, invoice);
    this._logAudit('INVOICE_REGISTERED', {
      invoiceId: invoice.id,
      amount: invoice.amount,
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      customer: invoice.customer.name,
    });
    return invoice;
  }

  /**
   * Retrieves an invoice by ID.
   * @param {string} id
   * @returns {Invoice|undefined}
   */
  getInvoice(id) {
    return this.invoices.get(id);
  }

  /**
   * Lists registered invoices with optional filtering.
   * @param {Object} [filter={}]
   * @returns {Invoice[]}
   */
  listInvoices(filter = {}) {
    let result = Array.from(this.invoices.values());

    if (filter.status) {
      result = result.filter(inv => inv.status === filter.status);
    }
    if (filter.agingBucket && filter.asOfDate) {
      result = result.filter(inv => inv.getAgingBucket(filter.asOfDate) === filter.agingBucket);
    }
    if (filter.overdueOnly) {
      const asOf = filter.asOfDate ? new Date(filter.asOfDate) : new Date();
      result = result.filter(inv => inv.getDaysPastDue(asOf) > 0 && inv.balance > 0);
    }
    return result;
  }

  /**
   * Evaluates an invoice against policy rules and determines next state / action.
   *
   * @param {Invoice} invoice
   * @param {Date|string} [asOfDate=new Date()]
   * @returns {Object} Decision output
   */
  evaluateInvoice(invoice, asOfDate = new Date()) {
    const asOf = new Date(asOfDate);
    const daysOverdue = invoice.getDaysPastDue(asOf);
    const priority = invoice.calculatePriority(asOf);

    // Rule 1: Paid or zero balance accounts require no recovery action
    if (invoice.balance <= 0 || invoice.status === InvoiceStatus.PAID) {
      return {
        decision: AgentDecisionType.NO_ACTION,
        reason: 'Invoice is fully paid',
        requiresApproval: false,
        priority,
      };
    }

    // Rule 2: Invoices not yet overdue require no dunning
    if (daysOverdue <= 0) {
      return {
        decision: AgentDecisionType.NO_ACTION,
        reason: `Invoice is current (due in ${Math.abs(daysOverdue)} days)`,
        requiresApproval: false,
        priority,
      };
    }

    // Rule 3: Legal dispute -> Immediate human approval & legal escalation gate
    if (invoice.isLegalDispute()) {
      return {
        decision: AgentDecisionType.REQUIRE_APPROVAL,
        approvalReasons: ['Active legal dispute requires compliance & human legal sign-off'],
        requiresApproval: true,
        isLegalHold: true,
        priority,
      };
    }

    // Rule 4: Commercial dispute -> Route for dispute resolution
    if (invoice.isDisputed()) {
      return {
        decision: AgentDecisionType.DISPUTE_REVIEW,
        approvalReasons: [`Commercial dispute open: ${invoice.dispute.reason}`],
        requiresApproval: true,
        isDisputed: true,
        priority,
      };
    }

    // Rule 5: Check communication cooldown to prevent spamming customers
    const recentComm = this._getMostRecentCommunication(invoice);
    if (recentComm) {
      const diffMs = asOf.getTime() - new Date(recentComm.timestamp).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < this.cooldownDays) {
        return {
          decision: AgentDecisionType.NO_ACTION,
          reason: `In cooldown window (last contacted ${diffDays.toFixed(1)} days ago, cooldown is ${this.cooldownDays} days)`,
          requiresApproval: false,
          priority,
        };
      }
    }

    // Generate draft dunning message
    const draftMessage = generateDunningMessage(invoice, { asOfDate: asOf });
    const approvalReasons = [];

    // Rule 6: High-value account check (>= threshold, default $5,000)
    if (invoice.balance >= this.highValueThreshold) {
      approvalReasons.push(`High-value invoice balance ($${invoice.balance.toLocaleString()} >= $${this.highValueThreshold.toLocaleString()})`);
    }

    // Rule 7: Tier 4 Final Demand check
    if (this.requireApprovalForFinalDemand && draftMessage.tier === DunningTier.TIER_4_FINAL_DEMAND) {
      approvalReasons.push('Final demand notice (Tier 4) requires human management sign-off');
    }

    if (approvalReasons.length > 0) {
      return {
        decision: AgentDecisionType.REQUIRE_APPROVAL,
        approvalReasons,
        requiresApproval: true,
        draftMessage,
        priority,
      };
    }

    // Rule 8: Low-risk, safe reminder
    return {
      decision: AgentDecisionType.SAFE_REMINDER,
      reason: 'Low-risk account passed all automated policy guardrails',
      requiresApproval: false,
      draftMessage,
      priority,
    };
  }

  /**
   * Processes a single invoice according to the decision state machine.
   *
   * @param {Invoice} invoice
   * @param {Date|string} [asOfDate=new Date()]
   * @returns {Object} Action record or evaluation summary
   */
  processInvoice(invoice, asOfDate = new Date()) {
    const evaluation = this.evaluateInvoice(invoice, asOfDate);

    if (evaluation.decision === AgentDecisionType.NO_ACTION) {
      return {
        invoiceId: invoice.id,
        decision: evaluation.decision,
        reason: evaluation.reason,
        executed: false,
      };
    }

    if (evaluation.decision === AgentDecisionType.REQUIRE_APPROVAL || evaluation.decision === AgentDecisionType.DISPUTE_REVIEW) {
      const actionId = `ACT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const actionRecord = {
        id: actionId,
        invoiceId: invoice.id,
        customerName: invoice.customer.name,
        balance: invoice.balance,
        decision: evaluation.decision,
        status: ActionStatus.PENDING_APPROVAL,
        approvalReasons: evaluation.approvalReasons,
        draftMessage: evaluation.draftMessage || null,
        priority: evaluation.priority,
        createdAt: new Date().toISOString(),
        executedAt: null,
      };

      this.actions.set(actionId, actionRecord);
      this._logAudit('ACTION_FLAGGED_FOR_APPROVAL', {
        actionId,
        invoiceId: invoice.id,
        reasons: evaluation.approvalReasons,
        balance: invoice.balance,
      });

      return actionRecord;
    }

    if (evaluation.decision === AgentDecisionType.SAFE_REMINDER) {
      if (this.autoSendSafeReminders) {
        return this._executeReminder(invoice, evaluation.draftMessage, 'AUTOMATED_SAFE_DISPATCH');
      } else {
        const actionId = `ACT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const actionRecord = {
          id: actionId,
          invoiceId: invoice.id,
          customerName: invoice.customer.name,
          balance: invoice.balance,
          decision: evaluation.decision,
          status: ActionStatus.PENDING_APPROVAL,
          approvalReasons: ['Auto-send disabled by configuration'],
          draftMessage: evaluation.draftMessage,
          priority: evaluation.priority,
          createdAt: new Date().toISOString(),
          executedAt: null,
        };
        this.actions.set(actionId, actionRecord);
        return actionRecord;
      }
    }

    return evaluation;
  }

  /**
   * Approves a pending action and executes it immediately.
   *
   * @param {string} actionId
   * @param {Object} approverDetails - { name, email, notes }
   * @returns {Object} Executed action record
   */
  approveAction(actionId, approverDetails = {}) {
    const action = this.actions.get(actionId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }
    if (action.status !== ActionStatus.PENDING_APPROVAL) {
      throw new Error(`Action ${actionId} cannot be approved from status: ${action.status}`);
    }

    const invoice = this.getInvoice(action.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found for action: ${action.invoiceId}`);
    }

    action.status = ActionStatus.APPROVED;
    action.approvedBy = {
      name: approverDetails.name || 'System Admin',
      email: approverDetails.email || 'admin@cashhound.io',
      notes: approverDetails.notes || '',
      approvedAt: new Date().toISOString(),
    };

    if (action.draftMessage) {
      const commRecord = invoice.recordCommunication({
        tier: action.draftMessage.tier,
        tone: action.draftMessage.tone,
        subject: action.draftMessage.subject,
        body: action.draftMessage.body,
        status: 'sent',
        requiresApproval: false,
      });
      action.communicationRecord = commRecord;
    }

    action.executedAt = new Date().toISOString();
    this._logAudit('ACTION_APPROVED_AND_EXECUTED', {
      actionId,
      invoiceId: invoice.id,
      approver: action.approvedBy.name,
    });

    return action;
  }

  /**
   * Rejects a pending action with explanation.
   *
   * @param {string} actionId
   * @param {string} reason
   * @param {Object} [rejectorDetails={}]
   * @returns {Object} Rejected action record
   */
  rejectAction(actionId, reason, rejectorDetails = {}) {
    const action = this.actions.get(actionId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }
    if (action.status !== ActionStatus.PENDING_APPROVAL) {
      throw new Error(`Action ${actionId} cannot be rejected from status: ${action.status}`);
    }

    action.status = ActionStatus.REJECTED;
    action.rejectedBy = {
      name: rejectorDetails.name || 'System Admin',
      email: rejectorDetails.email || 'admin@cashhound.io',
      reason: reason || 'Action rejected by operator',
      rejectedAt: new Date().toISOString(),
    };

    this._logAudit('ACTION_REJECTED', {
      actionId,
      invoiceId: action.invoiceId,
      reason,
      rejector: action.rejectedBy.name,
    });

    return action;
  }

  /**
   * Handles payment arrival, reconciles balance, clears pending dunning actions,
   * drafts/sends a payment receipt, and records audit trail.
   *
   * @param {string} invoiceId
   * @param {Object} paymentDetails - { amount, method, reference, date }
   * @returns {Object} Reconciliation summary
   */
  recordPayment(invoiceId, paymentDetails) {
    const invoice = this.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const { amount, method = 'electronic', reference = '', date = new Date() } = paymentDetails;
    const initialBalance = invoice.balance;
    const pmtResult = invoice.applyPayment({ amount, date, method, reference });

    // Cancel any active pending dunning actions on this invoice
    const cancelledActions = [];
    for (const action of this.actions.values()) {
      if (action.invoiceId === invoiceId && action.status === ActionStatus.PENDING_APPROVAL) {
        action.status = ActionStatus.CANCELLED;
        action.cancelledReason = `Payment of $${amount.toFixed(2)} received; pending action superseded`;
        cancelledActions.push(action.id);
      }
    }

    // Create receipt acknowledgment message
    const receiptSubject = `Payment Received - Thank You (Invoice ${invoice.id})`;
    const receiptBody = [
      `Dear ${invoice.customer.name},`,
      '',
      `Thank you! We have successfully received and applied your payment of $${amount.toFixed(2)}.`,
      `Invoice: ${invoice.id}`,
      `Payment Reference: ${reference || pmtResult.paymentRecord.id}`,
      `Remaining Balance: $${pmtResult.remainingBalance.toFixed(2)}`,
      '',
      pmtResult.isFullyPaid
        ? `This invoice is now fully settled. We appreciate your business!`
        : `Your remaining balance of $${pmtResult.remainingBalance.toFixed(2)} remains due according to standard terms.`,
      '',
      `Best regards,`,
      `Finance & Accounts Receivable`,
    ].join('\n');

    const receiptComm = invoice.recordCommunication({
      tier: 0,
      tone: 'friendly',
      subject: receiptSubject,
      body: receiptBody,
      status: 'sent',
      requiresApproval: false,
    });

    this._logAudit('PAYMENT_RECONCILED', {
      invoiceId,
      amount,
      initialBalance,
      remainingBalance: pmtResult.remainingBalance,
      isFullyPaid: pmtResult.isFullyPaid,
      cancelledPendingActions: cancelledActions,
    });

    return {
      invoiceId,
      initialBalance,
      amountPaid: amount,
      remainingBalance: pmtResult.remainingBalance,
      isFullyPaid: pmtResult.isFullyPaid,
      receiptCommunication: receiptComm,
      cancelledActions,
    };
  }

  /**
   * Reconciles a payment received from an external feed/webhook with CashHound.
   * Alias for recordPayment with flexible parameter names.
   *
   * @param {string} invoiceId
   * @param {Object} paymentDetails
   * @returns {Object}
   */
  reconcilePayment(invoiceId, paymentDetails) {
    return this.recordPayment(invoiceId, {
      amount: paymentDetails.amount,
      method: paymentDetails.method || paymentDetails.paymentMethod || 'electronic',
      reference: paymentDetails.reference || paymentDetails.txId || '',
      date: paymentDetails.date || paymentDetails.paidAt || new Date(),
    });
  }

  /**
   * Raises a dispute on an invoice.
   *
   * @param {string} invoiceId
   * @param {Object} disputeDetails
   * @returns {Invoice}
   */
  raiseDispute(invoiceId, disputeDetails) {
    const invoice = this.getInvoice(invoiceId);
    if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);
    invoice.markDisputed(disputeDetails);
    this._logAudit('DISPUTE_RAISED', {
      invoiceId,
      isLegal: Boolean(disputeDetails.isLegal),
      reason: disputeDetails.reason,
    });
    return invoice;
  }

  /**
   * Resolves an open dispute on an invoice.
   *
   * @param {string} invoiceId
   * @param {Object} resolutionDetails
   * @returns {Invoice}
   */
  resolveDispute(invoiceId, resolutionDetails) {
    const invoice = this.getInvoice(invoiceId);
    if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);
    invoice.resolveDispute(resolutionDetails);
    this._logAudit('DISPUTE_RESOLVED', {
      invoiceId,
      resolution: resolutionDetails.resolution,
    });
    return invoice;
  }

  /**
   * Retrieves all currently pending actions requiring human approval.
   * @returns {Object[]}
   */
  getPendingApprovals() {
    return Array.from(this.actions.values()).filter(
      act => act.status === ActionStatus.PENDING_APPROVAL
    );
  }

  /**
   * Executes a periodic evaluation cycle across all registered invoices.
   *
   * @param {Date|string} [asOfDate=new Date()]
   * @returns {Object} Cycle summary report
   */
  runCycle(asOfDate = new Date()) {
    const asOf = new Date(asOfDate);
    const summary = {
      asOfDate: asOf.toISOString(),
      totalInvoices: this.invoices.size,
      totalOutstandingBalance: 0,
      agingBreakdown: {
        [AgingBuckets.CURRENT]: 0,
        [AgingBuckets.DAYS_30]: 0,
        [AgingBuckets.DAYS_60]: 0,
        [AgingBuckets.DAYS_90]: 0,
      },
      actionsAutoSent: 0,
      actionsFlaggedForApproval: 0,
      noActionCount: 0,
      flaggedHighValueCount: 0,
      legalDisputeCount: 0,
      processedInvoices: [],
    };

    for (const invoice of this.invoices.values()) {
      summary.totalOutstandingBalance = Number((summary.totalOutstandingBalance + invoice.balance).toFixed(2));
      const bucket = invoice.getAgingBucket(asOf);
      summary.agingBreakdown[bucket] = (summary.agingBreakdown[bucket] || 0) + 1;

      if (invoice.isLegalDispute()) {
        summary.legalDisputeCount++;
      }
      if (invoice.balance >= this.highValueThreshold) {
        summary.flaggedHighValueCount++;
      }

      const result = this.processInvoice(invoice, asOf);
      summary.processedInvoices.push(result);

      if (result.status === ActionStatus.PENDING_APPROVAL) {
        summary.actionsFlaggedForApproval++;
      } else if (result.status === ActionStatus.AUTO_EXECUTED) {
        summary.actionsAutoSent++;
      } else {
        summary.noActionCount++;
      }
    }

    this._logAudit('CYCLE_COMPLETED', {
      totalInvoices: summary.totalInvoices,
      totalBalance: summary.totalOutstandingBalance,
      autoSent: summary.actionsAutoSent,
      flaggedForApproval: summary.actionsFlaggedForApproval,
    });

    return summary;
  }

  /**
   * Returns immutable copy of the audit log.
   * @returns {Object[]}
   */
  getAuditLog() {
    return [...this.auditTrail];
  }

  // --- Internal helpers ---

  _executeReminder(invoice, draftMessage, executionMode) {
    const commRecord = invoice.recordCommunication({
      tier: draftMessage.tier,
      tone: draftMessage.tone,
      subject: draftMessage.subject,
      body: draftMessage.body,
      status: 'sent',
      requiresApproval: false,
    });

    const actionId = `ACT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const actionRecord = {
      id: actionId,
      invoiceId: invoice.id,
      customerName: invoice.customer.name,
      balance: invoice.balance,
      decision: AgentDecisionType.SAFE_REMINDER,
      status: ActionStatus.AUTO_EXECUTED,
      executionMode,
      draftMessage,
      communicationRecord: commRecord,
      createdAt: new Date().toISOString(),
      executedAt: new Date().toISOString(),
    };

    this.actions.set(actionId, actionRecord);
    this._logAudit('SAFE_REMINDER_AUTO_SENT', {
      actionId,
      invoiceId: invoice.id,
      tier: draftMessage.tier,
      balance: invoice.balance,
    });

    return actionRecord;
  }

  _getMostRecentCommunication(invoice) {
    if (!invoice.communications || invoice.communications.length === 0) return null;
    return invoice.communications[invoice.communications.length - 1];
  }

  _logAudit(eventType, payload) {
    this.auditTrail.push({
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date().toISOString(),
      eventType,
      payload,
    });
  }
}
