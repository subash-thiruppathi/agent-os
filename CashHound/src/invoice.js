/**
 * CashHound - Invoice Model & Aging Engine
 * Handles invoice state, aging classification, dispute status, and priority scoring.
 */

export const AgingBuckets = Object.freeze({
  CURRENT: 'current',
  DAYS_30: '30+',
  DAYS_60: '60+',
  DAYS_90: '90+',
});

export const InvoiceStatus = Object.freeze({
  DRAFT: 'draft',
  ISSUED: 'issued',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  DISPUTED: 'disputed',
  WRITTEN_OFF: 'written_off',
  IN_COLLECTION: 'in_collection',
});

export const CustomerTier = Object.freeze({
  VIP: 'vip',
  STANDARD: 'standard',
  AT_RISK: 'at_risk',
});

export const PriorityLevel = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export class Invoice {
  /**
   * @param {Object} params
   * @param {string} params.id - Unique invoice identifier (e.g. 'INV-2024-001')
   * @param {Object} params.customer - Customer details
   * @param {string} params.customer.name - Customer name
   * @param {string} params.customer.email - Customer email
   * @param {string} [params.customer.tier='standard'] - 'vip' | 'standard' | 'at_risk'
   * @param {number} params.amount - Total invoice amount
   * @param {number} [params.amountPaid=0] - Amount collected so far
   * @param {string} [params.currency='USD'] - Currency code
   * @param {string|Date} params.issueDate - Issue date
   * @param {string|Date} params.dueDate - Due date
   * @param {string} [params.status='issued'] - Invoice status
   * @param {Object|null} [params.dispute=null] - Dispute details if any
   * @param {Array} [params.paymentHistory=[]] - Recorded payments
   * @param {Array} [params.communications=[]] - Prior dunning / communication logs
   * @param {Object} [params.metadata={}] - Custom metadata / tags
   */
  constructor({
    id,
    customer,
    amount,
    amountPaid = 0,
    currency = 'USD',
    issueDate,
    dueDate,
    status = InvoiceStatus.ISSUED,
    dispute = null,
    paymentHistory = [],
    communications = [],
    metadata = {},
  }) {
    if (!id) throw new Error('Invoice id is required');
    if (!customer || !customer.name) throw new Error('Customer with name is required');
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new Error('Valid positive amount is required');
    }
    if (!dueDate) throw new Error('dueDate is required');

    this.id = id;
    this.customer = {
      id: customer.id || `CUST-${id}`,
      name: customer.name,
      email: customer.email || '',
      tier: customer.tier || CustomerTier.STANDARD,
      phone: customer.phone || '',
    };
    this.amount = Number(amount.toFixed(2));
    this.amountPaid = Number((amountPaid || 0).toFixed(2));
    this.balance = Number(Math.max(0, this.amount - this.amountPaid).toFixed(2));
    this.currency = currency;
    this.issueDate = issueDate ? new Date(issueDate) : new Date();
    this.dueDate = new Date(dueDate);
    this.status = status;
    this.dispute = dispute ? { ...dispute } : null;
    this.paymentHistory = [...paymentHistory];
    this.communications = [...communications];
    this.metadata = { ...metadata };
    this.createdAt = new Date();
    this.updatedAt = new Date();

    if (this.balance <= 0 && this.status !== InvoiceStatus.WRITTEN_OFF) {
      this.status = InvoiceStatus.PAID;
    } else if (this.dispute && this.dispute.status === 'open') {
      this.status = InvoiceStatus.DISPUTED;
    }
  }

  /**
   * Calculates days past due relative to reference date.
   * Negative or zero means not yet overdue (current).
   * @param {Date|string} [asOfDate=new Date()]
   * @returns {number}
   */
  getDaysPastDue(asOfDate = new Date()) {
    const asOf = new Date(asOfDate);
    const due = new Date(this.dueDate);
    // Reset time components to compare calendar days cleanly
    asOf.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffTime = asOf.getTime() - due.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Computes the aging bucket (current, 30+, 60+, 90+ days).
   * @param {Date|string} [asOfDate=new Date()]
   * @returns {string} One of AgingBuckets values ('current', '30+', '60+', '90+')
   */
  getAgingBucket(asOfDate = new Date()) {
    const days = this.getDaysPastDue(asOfDate);
    if (days <= 0) return AgingBuckets.CURRENT;
    if (days <= 30) return AgingBuckets.DAYS_30;
    if (days <= 60) return AgingBuckets.DAYS_60;
    return AgingBuckets.DAYS_90;
  }

  /**
   * Marks this invoice as disputed.
   * @param {Object} details
   * @param {string} details.reason - Reason for dispute
   * @param {boolean} [details.isLegal=false] - Whether dispute involves legal action / attorney
   * @param {string} [details.notes=''] - Additional contextual notes
   * @param {Date|string} [details.raisedAt=new Date()]
   */
  markDisputed({ reason, isLegal = false, notes = '', raisedAt = new Date() }) {
    if (!reason) throw new Error('Dispute reason is required');
    this.dispute = {
      reason,
      isLegal: Boolean(isLegal),
      notes,
      raisedAt: new Date(raisedAt),
      status: 'open',
    };
    this.status = InvoiceStatus.DISPUTED;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Resolves an existing dispute.
   * @param {Object} details
   * @param {string} details.resolution - How the dispute was resolved
   * @param {string} [details.notes=''] - Additional notes
   * @param {Date|string} [details.resolvedAt=new Date()]
   */
  resolveDispute({ resolution, notes = '', resolvedAt = new Date() }) {
    if (!this.dispute) throw new Error('Invoice is not disputed');
    this.dispute = {
      ...this.dispute,
      status: 'resolved',
      resolution,
      notes: notes || this.dispute.notes,
      resolvedAt: new Date(resolvedAt),
    };
    this.status = this.balance <= 0 ? InvoiceStatus.PAID : (this.amountPaid > 0 ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.ISSUED);
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Returns true if there is an active (open) dispute on this invoice.
   * @returns {boolean}
   */
  isDisputed() {
    return Boolean(this.dispute && this.dispute.status === 'open');
  }

  /**
   * Returns true if this invoice has an open legal dispute.
   * @returns {boolean}
   */
  isLegalDispute() {
    return Boolean(this.isDisputed() && this.dispute.isLegal);
  }

  /**
   * Applies a payment and recalculates balance and status.
   * @param {Object} params
   * @param {number} params.amount - Payment amount
   * @param {Date|string} [params.date=new Date()]
   * @param {string} [params.method='electronic'] - 'ach', 'card', 'wire', 'check'
   * @param {string} [params.reference=''] - External payment reference or ID
   * @returns {{ invoice: Invoice, remainingBalance: number, isFullyPaid: boolean }}
   */
  applyPayment({ amount, date = new Date(), method = 'electronic', reference = '' }) {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Payment amount must be a positive number');
    }
    const paymentRecord = {
      id: `PMT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      amount: Number(amount.toFixed(2)),
      date: new Date(date),
      method,
      reference,
    };
    this.paymentHistory.push(paymentRecord);
    this.amountPaid = Number((this.amountPaid + paymentRecord.amount).toFixed(2));
    this.balance = Number(Math.max(0, this.amount - this.amountPaid).toFixed(2));

    if (this.balance === 0) {
      this.status = InvoiceStatus.PAID;
    } else {
      this.status = InvoiceStatus.PARTIALLY_PAID;
    }
    this.updatedAt = new Date();

    return {
      invoice: this,
      paymentRecord,
      remainingBalance: this.balance,
      isFullyPaid: this.balance === 0,
    };
  }

  /**
   * Records a communication event (e.g. reminder, notice, settlement offer).
   * @param {Object} communication
   */
  recordCommunication(communication) {
    const record = {
      id: communication.id || `COMM-${Date.now()}`,
      timestamp: communication.timestamp ? new Date(communication.timestamp) : new Date(),
      tier: communication.tier,
      tone: communication.tone,
      subject: communication.subject,
      body: communication.body,
      status: communication.status || 'sent',
      requiresApproval: Boolean(communication.requiresApproval),
    };
    this.communications.push(record);
    this.updatedAt = new Date();
    return record;
  }

  /**
   * Calculates dynamic recovery priority score and risk tier.
   * Takes into account:
   * 1. Days overdue & aging bucket
   * 2. Outstanding balance value
   * 3. Dispute & legal exposure
   * 4. Customer relationship tier
   *
   * @param {Date|string} [asOfDate=new Date()]
   * @returns {{ score: number, level: string, reasons: string[] }}
   */
  calculatePriority(asOfDate = new Date()) {
    if (this.status === InvoiceStatus.PAID || this.balance <= 0) {
      return { score: 0, level: PriorityLevel.LOW, reasons: ['Invoice is fully paid'] };
    }

    const days = this.getDaysPastDue(asOfDate);
    const bucket = this.getAgingBucket(asOfDate);
    let score = 0;
    const reasons = [];

    // 1. Aging factor (0 - 45 pts)
    if (bucket === AgingBuckets.CURRENT) {
      score += 5;
      reasons.push('Current invoice: within normal terms');
    } else if (bucket === AgingBuckets.DAYS_30) {
      score += 25;
      reasons.push(`30+ days overdue (${days} days)`);
    } else if (bucket === AgingBuckets.DAYS_60) {
      score += 40;
      reasons.push(`60+ days overdue (${days} days)`);
    } else {
      score += 55;
      reasons.push(`90+ days severely overdue (${days} days)`);
    }

    // 2. Outstanding Balance factor (0 - 35 pts)
    if (this.balance >= 10000) {
      score += 35;
      reasons.push(`Very high balance ($${this.balance.toLocaleString()})`);
    } else if (this.balance >= 5000) {
      score += 25;
      reasons.push(`High balance ($${this.balance.toLocaleString()} >= $5,000 threshold)`);
    } else if (this.balance >= 1000) {
      score += 15;
      reasons.push(`Moderate balance ($${this.balance.toLocaleString()})`);
    } else {
      score += 5;
      reasons.push(`Low balance ($${this.balance.toLocaleString()})`);
    }

    // 3. Customer Tier adjustment
    if (this.customer.tier === CustomerTier.AT_RISK) {
      score += 15;
      reasons.push('Customer flagged as at-risk');
    } else if (this.customer.tier === CustomerTier.VIP) {
      // VIP accounts require sensitive handling
      score -= 5;
      reasons.push('VIP relationship: prioritize relationship preservation');
    }

    // 4. Dispute status
    if (this.isLegalDispute()) {
      score = Math.max(score, 90);
      reasons.push('Active legal dispute: legal escalation gate active');
    } else if (this.isDisputed()) {
      reasons.push('Commercial dispute pending: resolution needed prior to dunning');
    }

    // Normalize score
    score = Math.max(0, Math.min(100, score));

    let level;
    if (score >= 80) level = PriorityLevel.CRITICAL;
    else if (score >= 60) level = PriorityLevel.HIGH;
    else if (score >= 35) level = PriorityLevel.MEDIUM;
    else level = PriorityLevel.LOW;

    return { score, level, reasons };
  }

  toJSON() {
    return {
      id: this.id,
      customer: this.customer,
      amount: this.amount,
      amountPaid: this.amountPaid,
      balance: this.balance,
      currency: this.currency,
      issueDate: this.issueDate.toISOString(),
      dueDate: this.dueDate.toISOString(),
      status: this.status,
      dispute: this.dispute,
      paymentHistory: this.paymentHistory,
      communications: this.communications,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data) {
    return new Invoice({
      id: data.id,
      customer: data.customer,
      amount: data.amount,
      amountPaid: data.amountPaid,
      currency: data.currency,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      status: data.status,
      dispute: data.dispute,
      paymentHistory: data.paymentHistory,
      communications: data.communications,
      metadata: data.metadata,
    });
  }
}
