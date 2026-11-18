/**
 * ResolveX Agent - Autonomous Customer Resolution Decision Engine
 * Orchestrates diagnosis, policy guardrails, autonomous low-risk execution,
 * and human-in-the-loop (HITL) escalation workflows.
 */

import crypto from 'node:crypto';
import { PolicyEngine, CustomerTier, IssueSeverity } from './policy.js';
import { DiagnosisEngine, IncidentType } from './diagnosis.js';

export const ResolutionStatus = Object.freeze({
  RESOLVED_AUTONOMOUSLY: 'RESOLVED_AUTONOMOUSLY',
  REQUIRES_APPROVAL: 'REQUIRES_APPROVAL',
  RESOLVED_BY_APPROVAL: 'RESOLVED_BY_APPROVAL',
  REJECTED_BY_REVIEWER: 'REJECTED_BY_REVIEWER',
  FAILED: 'FAILED',
});

export const ActionType = Object.freeze({
  REFUND: 'REFUND',
  REPLACEMENT: 'REPLACEMENT',
  APOLOGY_CREDIT: 'APOLOGY_CREDIT',
  CARRIER_INQUIRY: 'CARRIER_INQUIRY',
  DISPATCH_TECHNICIAN: 'DISPATCH_TECHNICIAN',
});

let idCounter = 1;
function generateId(prefix = 'RES') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${(idCounter++).toString().padStart(4, '0')}`;
}

export class ResolveXAgent {
  constructor(options = {}) {
    this.policyEngine = options.policyEngine || new PolicyEngine(options.policyConfig);
    this.diagnosisEngine = options.diagnosisEngine || new DiagnosisEngine();
    this.auditLog = [];
    this.pendingApprovals = new Map();
    this.cases = new Map();
    this.executedIdempotencyKeys = new Map();
    this.refundedTransactions = new Set();
    this.executionAdapter = options.executionAdapter || this._defaultExecutionAdapter();
  }

  /**
   * Primary entry point to resolve an inbound customer issue.
   */
  async resolveIssue({ customer, order = {}, issue, context = {} }) {
    const caseId = issue.caseId || generateId('CASE');
    const startedAt = new Date().toISOString();

    this._recordAudit({
      caseId,
      stage: 'INGESTION',
      actor: 'SYSTEM',
      action: 'ISSUE_INGESTED',
      details: {
        customerId: customer.id,
        issueType: issue.type,
        issueText: issue.description || issue.subject,
      },
    });

    // 1. Context validation & customer authentication check
    if (!customer || !customer.id) {
      const error = 'Unauthenticated customer context';
      this._recordAudit({ caseId, stage: 'AUTHENTICATION', actor: 'SYSTEM', action: 'FAILED', details: { error } });
      return { caseId, status: ResolutionStatus.FAILED, error };
    }

    // Combine transaction/shipment context from order if present
    const enrichedContext = {
      ...context,
      transactions: context.transactions || order.transactions || [],
      shipment: context.shipment || order.shipment || null,
      deviceTelemetry: context.deviceTelemetry || null,
      currentDate: context.currentDate || new Date(),
    };

    // 2. Incident Diagnosis
    const diagnosis = this.diagnosisEngine.diagnose(issue, enrichedContext);

    this._recordAudit({
      caseId,
      stage: 'DIAGNOSIS',
      actor: 'AGENT',
      action: 'DIAGNOSIS_COMPLETED',
      details: {
        rootCause: diagnosis.rootCause,
        confidence: diagnosis.confidence,
        severity: diagnosis.severity,
        verifiedFacts: diagnosis.verifiedFacts,
      },
    });

    // 3. Propose Resolution Plan based on Diagnosis & Customer Intent
    const proposedPlan = this._formulatePlan({ customer, order, issue, diagnosis, context: enrichedContext });

    this._recordAudit({
      caseId,
      stage: 'POLICY_EVALUATION',
      actor: 'POLICY_ENGINE',
      action: 'PLAN_PROPOSED',
      details: {
        actionsCount: proposedPlan.actions.length,
        requiresApproval: proposedPlan.requiresApproval,
        reasons: proposedPlan.approvalReasons,
      },
    });

    // 4. Progressive Autonomy Execution Branch
    if (proposedPlan.requiresApproval) {
      const ticketId = generateId('TICK');
      const ticket = {
        ticketId,
        caseId,
        createdAt: new Date().toISOString(),
        customer: { id: customer.id, name: customer.name, tier: customer.tier || CustomerTier.STANDARD },
        diagnosis,
        proposedPlan,
        status: 'PENDING_APPROVAL',
        escalationReason: proposedPlan.approvalReasons.join('; '),
      };

      this.pendingApprovals.set(ticketId, ticket);
      this.cases.set(caseId, { caseId, ticketId, customer, order, issue, diagnosis, plan: proposedPlan, status: ResolutionStatus.REQUIRES_APPROVAL });

      this._recordAudit({
        caseId,
        stage: 'ESCALATION',
        actor: 'AGENT',
        action: 'HUMAN_APPROVAL_REQUESTED',
        details: {
          ticketId,
          escalationReason: ticket.escalationReason,
          pendingActions: proposedPlan.actions.map((a) => a.type),
        },
      });

      return {
        caseId,
        ticketId,
        status: ResolutionStatus.REQUIRES_APPROVAL,
        diagnosis,
        proposedPlan,
        message: `Action requires human agent approval: ${ticket.escalationReason}`,
      };
    }

    // 5. Execute Autonomous Safe Actions
    const executionResults = await this._executeActions(proposedPlan.actions, { customer, order, caseId });

    this.cases.set(caseId, {
      caseId,
      customer,
      order,
      issue,
      diagnosis,
      plan: proposedPlan,
      status: ResolutionStatus.RESOLVED_AUTONOMOUSLY,
      executionResults,
      resolvedAt: new Date().toISOString(),
    });

    this._recordAudit({
      caseId,
      stage: 'EXECUTION',
      actor: 'AGENT',
      action: 'AUTONOMOUS_RESOLUTION_EXECUTED',
      details: {
        executedActions: executionResults,
      },
    });

    return {
      caseId,
      status: ResolutionStatus.RESOLVED_AUTONOMOUSLY,
      diagnosis,
      actionsTaken: executionResults,
      summary: this._generateResolutionSummary(executionResults, diagnosis),
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Reviewer approval for pending ticket.
   */
  async approveTicket(ticketId, { reviewerId = 'HUMAN_SUPERVISOR', notes = '' } = {}) {
    const ticket = this.pendingApprovals.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    if (ticket.status !== 'PENDING_APPROVAL') {
      throw new Error(`Ticket ${ticketId} is already in ${ticket.status} state`);
    }

    const { caseId, proposedPlan, customer, order } = ticket;

    // Execute approved actions
    const executionResults = await this._executeActions(proposedPlan.actions, { customer, order, caseId });

    ticket.status = 'APPROVED';
    ticket.reviewedBy = reviewerId;
    ticket.reviewedAt = new Date().toISOString();
    ticket.reviewNotes = notes;
    ticket.executionResults = executionResults;

    const caseRecord = this.cases.get(caseId);
    if (caseRecord) {
      caseRecord.status = ResolutionStatus.RESOLVED_BY_APPROVAL;
      caseRecord.executionResults = executionResults;
      caseRecord.reviewedBy = reviewerId;
      caseRecord.resolvedAt = ticket.reviewedAt;
    }

    this._recordAudit({
      caseId,
      stage: 'HUMAN_IN_THE_LOOP',
      actor: reviewerId,
      action: 'TICKET_APPROVED_AND_EXECUTED',
      details: {
        ticketId,
        notes,
        executedActions: executionResults,
      },
    });

    return {
      caseId,
      ticketId,
      status: ResolutionStatus.RESOLVED_BY_APPROVAL,
      reviewerId,
      executedActions: executionResults,
      summary: `Approved by ${reviewerId}. Actions successfully executed.`,
      resolvedAt: ticket.reviewedAt,
    };
  }

  /**
   * Reviewer rejection for pending ticket with optional alternative action.
   */
  async rejectTicket(ticketId, { reviewerId = 'HUMAN_SUPERVISOR', reason = 'Request declined per review', alternativeAction = null } = {}) {
    const ticket = this.pendingApprovals.get(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    if (ticket.status !== 'PENDING_APPROVAL') {
      throw new Error(`Ticket ${ticketId} is already in ${ticket.status} state`);
    }

    const { caseId, customer, order } = ticket;
    let alternativeResult = null;

    if (alternativeAction) {
      alternativeResult = await this._executeActions([alternativeAction], { customer, order, caseId });
    }

    ticket.status = 'REJECTED';
    ticket.reviewedBy = reviewerId;
    ticket.reviewedAt = new Date().toISOString();
    ticket.rejectionReason = reason;
    ticket.alternativeResult = alternativeResult;

    const caseRecord = this.cases.get(caseId);
    if (caseRecord) {
      caseRecord.status = ResolutionStatus.REJECTED_BY_REVIEWER;
      caseRecord.rejectionReason = reason;
      caseRecord.alternativeResult = alternativeResult;
      caseRecord.reviewedBy = reviewerId;
      caseRecord.resolvedAt = ticket.reviewedAt;
    }

    this._recordAudit({
      caseId,
      stage: 'HUMAN_IN_THE_LOOP',
      actor: reviewerId,
      action: 'TICKET_REJECTED',
      details: {
        ticketId,
        reason,
        alternativeResult,
      },
    });

    return {
      caseId,
      ticketId,
      status: ResolutionStatus.REJECTED_BY_REVIEWER,
      reviewerId,
      reason,
      alternativeResult,
      resolvedAt: ticket.reviewedAt,
    };
  }

  /**
   * Formulate candidate plan and check policy boundaries.
   */
  _formulatePlan({ customer, order, issue, diagnosis, context }) {
    const actions = [];
    const approvalReasons = [];
    let requiresApproval = false;

    const customerTier = customer.tier || CustomerTier.STANDARD;

    switch (diagnosis.rootCause) {
      case IncidentType.DOUBLE_BILLING: {
        const refundAmount = diagnosis.evidence.duplicateTransaction?.duplicateAmount || issue.amount || 0;
        const refundCheck = this.policyEngine.validateRefund({
          amount: refundAmount,
          orderTotal: order.total || refundAmount,
          customerProfile: customer,
          incidentHistory: customer.incidentHistory || [],
        });

        actions.push({
          type: ActionType.REFUND,
          amount: refundAmount,
          currency: 'USD',
          targetTxId: diagnosis.evidence.duplicateTransaction?.duplicateTxId || 'TX_DUP',
          autonomousAllowed: refundCheck.allowedAutonomous,
          checkResult: refundCheck,
        });

        if (refundCheck.requiresApproval) {
          requiresApproval = true;
          approvalReasons.push(refundCheck.reason);
        }

        // Add apology credit for inconvenience
        const credit = this.policyEngine.calculateApologyCredit({
          severity: diagnosis.severity,
          customerTier,
        });
        actions.push({
          type: ActionType.APOLOGY_CREDIT,
          amount: credit.amount,
          currency: credit.currency,
          breakdown: credit.breakdown,
          autonomousAllowed: true,
        });
        break;
      }

      case IncidentType.PRODUCT_DEFECT: {
        const replacementCheck = this.policyEngine.validateReplacement({
          product: order.product || { name: 'Item', warrantyDays: 365 },
          purchaseDate: order.purchaseDate || order.orderDate,
          stockAvailable: order.stockAvailable ?? true,
          customerProfile: customer,
          incidentHistory: customer.incidentHistory || [],
        });

        if (issue.requestedAction === ActionType.REFUND) {
          const refundAmount = issue.amount || order.total || 0;
          const refundCheck = this.policyEngine.validateRefund({
            amount: refundAmount,
            orderTotal: order.total,
            customerProfile: customer,
            incidentHistory: customer.incidentHistory || [],
          });
          actions.push({
            type: ActionType.REFUND,
            amount: refundAmount,
            currency: 'USD',
            autonomousAllowed: refundCheck.allowedAutonomous,
            checkResult: refundCheck,
          });
          if (refundCheck.requiresApproval) {
            requiresApproval = true;
            approvalReasons.push(refundCheck.reason);
          }
        } else {
          actions.push({
            type: ActionType.REPLACEMENT,
            sku: order.product?.sku || 'SKU-REPLACE-DEFAULT',
            productName: order.product?.name || 'Replacement Unit',
            autonomousAllowed: replacementCheck.allowedAutonomous,
            checkResult: replacementCheck,
          });
          if (replacementCheck.requiresApproval) {
            requiresApproval = true;
            approvalReasons.push(replacementCheck.reason);
          }
        }

        const credit = this.policyEngine.calculateApologyCredit({
          severity: diagnosis.severity,
          customerTier,
        });
        actions.push({
          type: ActionType.APOLOGY_CREDIT,
          amount: credit.amount,
          currency: credit.currency,
          breakdown: credit.breakdown,
          autonomousAllowed: true,
        });
        break;
      }

      case IncidentType.SHIPPING_DELAY: {
        actions.push({
          type: ActionType.CARRIER_INQUIRY,
          trackingNumber: diagnosis.evidence.shipping?.trackingNumber || order.trackingNumber,
          carrier: diagnosis.evidence.shipping?.carrier || order.carrier,
          autonomousAllowed: true,
        });

        const credit = this.policyEngine.calculateApologyCredit({
          severity: diagnosis.severity,
          customerTier,
        });
        actions.push({
          type: ActionType.APOLOGY_CREDIT,
          amount: credit.amount,
          currency: credit.currency,
          breakdown: credit.breakdown,
          autonomousAllowed: true,
        });

        // If delayed >= 10 days, customer can be offered refund if requested
        if (issue.requestedAction === ActionType.REFUND || (diagnosis.evidence.shipping?.daysLate || 0) >= 10) {
          const refundAmount = issue.amount || order.total || 50;
          const refundCheck = this.policyEngine.validateRefund({
            amount: refundAmount,
            orderTotal: order.total,
            customerProfile: customer,
            incidentHistory: customer.incidentHistory || [],
          });
          actions.push({
            type: ActionType.REFUND,
            amount: refundAmount,
            currency: 'USD',
            autonomousAllowed: refundCheck.allowedAutonomous,
            checkResult: refundCheck,
          });
          if (refundCheck.requiresApproval) {
            requiresApproval = true;
            approvalReasons.push(refundCheck.reason);
          }
        }
        break;
      }

      case IncidentType.SERVICE_OUTAGE: {
        const credit = this.policyEngine.calculateApologyCredit({
          severity: IssueSeverity.HIGH,
          customerTier,
        });
        actions.push({
          type: ActionType.APOLOGY_CREDIT,
          amount: credit.amount,
          currency: credit.currency,
          breakdown: credit.breakdown,
          reason: 'Service Outage SLA Credit',
          autonomousAllowed: true,
        });
        break;
      }

      default: {
        // Fallback for custom or direct refund request
        if (issue.requestedAction === ActionType.REFUND || issue.amount) {
          const refundAmount = issue.amount || 0;
          const refundCheck = this.policyEngine.validateRefund({
            amount: refundAmount,
            orderTotal: order.total,
            customerProfile: customer,
            incidentHistory: customer.incidentHistory || [],
          });
          actions.push({
            type: ActionType.REFUND,
            amount: refundAmount,
            currency: 'USD',
            autonomousAllowed: refundCheck.allowedAutonomous,
            checkResult: refundCheck,
          });
          if (refundCheck.requiresApproval) {
            requiresApproval = true;
            approvalReasons.push(refundCheck.reason);
          }
        } else {
          // Default inquiry & basic credit
          const credit = this.policyEngine.calculateApologyCredit({
            severity: IssueSeverity.LOW,
            customerTier,
          });
          actions.push({
            type: ActionType.APOLOGY_CREDIT,
            amount: credit.amount,
            currency: credit.currency,
            breakdown: credit.breakdown,
            autonomousAllowed: true,
          });
        }
        break;
      }
    }

    return {
      actions,
      requiresApproval,
      approvalReasons,
    };
  }

  /**
   * Execute approved or autonomous actions via adapter.
   */
  async _executeActions(actions, { customer, order, caseId }) {
    const results = [];
    for (const action of actions) {
      // SEC-04: Deterministic idempotency key to prevent replay attacks and race condition double-dispatches
      const idempotencyKey = crypto.createHash('sha256')
        .update(`${caseId}:${action.type}:${action.targetTxId || action.sku || action.amount}`)
        .digest('hex');

      if (this.executedIdempotencyKeys.has(idempotencyKey)) {
        results.push({
          actionType: action.type,
          parameters: action,
          outcome: { status: 'DUPLICATE_IDEMPOTENT_IGNORED', idempotencyKey, cachedOutcome: this.executedIdempotencyKeys.get(idempotencyKey) },
          executedAt: new Date().toISOString(),
        });
        continue;
      }

      if (action.type === ActionType.REFUND && action.targetTxId) {
        if (this.refundedTransactions.has(action.targetTxId)) {
          results.push({
            actionType: action.type,
            parameters: action,
            outcome: { status: 'BLOCKED_DUPLICATE_REFUND', error: `Transaction ${action.targetTxId} has already been refunded` },
            executedAt: new Date().toISOString(),
          });
          continue;
        }
      }

      let outcome;
      switch (action.type) {
        case ActionType.REFUND:
          outcome = await this.executionAdapter.processRefund({
            caseId,
            customerId: customer.id,
            amount: action.amount,
            currency: action.currency || 'USD',
            txId: action.targetTxId,
            idempotencyKey,
          });
          this.refundedTransactions.add(action.targetTxId);
          break;
        case ActionType.REPLACEMENT:
          outcome = await this.executionAdapter.orderReplacement({
            caseId,
            customerId: customer.id,
            sku: action.sku,
            productName: action.productName,
            shippingAddress: customer.shippingAddress || order.shippingAddress,
            idempotencyKey,
          });
          break;
        case ActionType.APOLOGY_CREDIT:
          outcome = await this.executionAdapter.issueCredit({
            caseId,
            customerId: customer.id,
            amount: action.amount,
            currency: action.currency || 'USD',
            breakdown: action.breakdown,
            idempotencyKey,
          });
          break;
        case ActionType.CARRIER_INQUIRY:
          outcome = await this.executionAdapter.escalateCarrier({
            caseId,
            trackingNumber: action.trackingNumber,
            carrier: action.carrier,
            idempotencyKey,
          });
          break;
        default:
          outcome = { status: 'SUCCESS', details: `Executed custom action ${action.type}` };
          break;
      }

      this.executedIdempotencyKeys.set(idempotencyKey, outcome);
      results.push({
        actionType: action.type,
        parameters: action,
        outcome,
        idempotencyKey,
        executedAt: new Date().toISOString(),
      });
    }
    return results;
  }

  _recordAudit(entry) {
    const record = {
      id: generateId('AUD'),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.auditLog.push(record);
    return record;
  }

  _generateResolutionSummary(results, diagnosis) {
    const actionSummaries = results.map((r) => {
      if (r.actionType === ActionType.REFUND) return `Processed refund of $${r.parameters.amount}`;
      if (r.actionType === ActionType.REPLACEMENT) return `Dispatched replacement order (${r.parameters.productName})`;
      if (r.actionType === ActionType.APOLOGY_CREDIT) return `Credited $${r.parameters.amount} to account`;
      if (r.actionType === ActionType.CARRIER_INQUIRY) return `Opened priority trace with carrier`;
      return `${r.actionType} completed`;
    });
    return `Resolved ${diagnosis.rootCause}: ${actionSummaries.join(', ')}.`;
  }

  _defaultExecutionAdapter() {
    return {
      processRefund: async ({ caseId, customerId, amount, currency }) => ({
        success: true,
        referenceId: generateId('RFND'),
        amount,
        currency,
        message: `Refund of ${currency} ${amount} processed successfully for customer ${customerId}`,
      }),
      orderReplacement: async ({ caseId, customerId, sku, productName }) => ({
        success: true,
        replacementOrderId: generateId('ORD-REP'),
        sku,
        productName,
        message: `Replacement order created for ${productName} (SKU: ${sku})`,
      }),
      issueCredit: async ({ caseId, customerId, amount, currency, breakdown }) => ({
        success: true,
        voucherCode: `VCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        amount,
        currency,
        breakdown,
        message: `Issued credit of ${currency} ${amount}`,
      }),
      escalateCarrier: async ({ caseId, trackingNumber, carrier }) => ({
        success: true,
        ticketNumber: generateId('CARR'),
        trackingNumber,
        carrier,
        status: 'CARRIER_NOTIFIED_PRIORITY',
      }),
    };
  }

  getPendingApprovals() {
    return Array.from(this.pendingApprovals.values()).filter((t) => t.status === 'PENDING_APPROVAL');
  }

  getPendingTicket(ticketId) {
    return this.pendingApprovals.get(ticketId) || null;
  }

  getCase(caseId) {
    return this.cases.get(caseId) || null;
  }

  getAuditLog(filter = {}) {
    let logs = [...this.auditLog];
    if (filter.caseId) {
      logs = logs.filter((l) => l.caseId === filter.caseId);
    }
    if (filter.stage) {
      logs = logs.filter((l) => l.stage === filter.stage);
    }
    if (filter.actor) {
      logs = logs.filter((l) => l.actor === filter.actor);
    }
    return logs;
  }
}
