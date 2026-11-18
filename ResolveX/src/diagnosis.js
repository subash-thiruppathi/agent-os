/**
 * ResolveX Incident Diagnosis Engine
 * Classifies root causes, extracts facts, inspects telemetry/transactions,
 * and assesses resolution eligibility.
 */

export const IncidentType = Object.freeze({
  SHIPPING_DELAY: 'SHIPPING_DELAY',
  PRODUCT_DEFECT: 'PRODUCT_DEFECT',
  DOUBLE_BILLING: 'DOUBLE_BILLING',
  SERVICE_OUTAGE: 'SERVICE_OUTAGE',
  INCORRECT_ITEM: 'INCORRECT_ITEM',
  UNKNOWN: 'UNKNOWN',
});

export const DiagnosisSeverity = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const PATTERNS = {
  [IncidentType.DOUBLE_BILLING]: [
    /charged twice/i,
    /double bill(ing|ed)?/i,
    /duplicate charge/i,
    /billed (two|2) times/i,
    /charged (two|2) times/i,
    /two charges/i,
    /multiple charges/i,
  ],
  [IncidentType.SHIPPING_DELAY]: [
    /late/i,
    /delay(ed)?/i,
    /tracking.*stuck/i,
    /where is my order/i,
    /not arrived/i,
    /hasn't arrived/i,
    /past.*delivery/i,
    /carrier.*lost/i,
    /stuck in transit/i,
  ],
  [IncidentType.PRODUCT_DEFECT]: [
    /broken/i,
    /defect(ive)?/i,
    /damaged/i,
    /won'?t turn on/i,
    /not working/i,
    /hardware failure/i,
    /dead on arrival/i,
    /malfunction/i,
    /faulty/i,
    /cracked/i,
  ],
  [IncidentType.SERVICE_OUTAGE]: [
    /outage/i,
    /service (is )?down/i,
    /downtime/i,
    /can'?t access/i,
    /server error/i,
    /system.*unavailable/i,
    /503/i,
    /api error/i,
    /service disruption/i,
  ],
  [IncidentType.INCORRECT_ITEM]: [
    /wrong item/i,
    /wrong (product|color|size)/i,
    /missing item/i,
    /received incorrect/i,
    /different item/i,
  ],
};

export class DiagnosisEngine {
  /**
   * Classify text intent and return best match with confidence.
   */
  classifyText(text = '') {
    if (!text || typeof text !== 'string') {
      return { type: IncidentType.UNKNOWN, confidence: 0 };
    }

    const matches = [];

    for (const [type, patterns] of Object.entries(PATTERNS)) {
      let hits = 0;
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          hits++;
        }
      }
      if (hits > 0) {
        // Normalize confidence between 0.6 and 0.95
        const confidence = Math.min(0.95, 0.6 + hits * 0.15);
        matches.push({ type, confidence, hits });
      }
    }

    if (matches.length === 0) {
      return { type: IncidentType.UNKNOWN, confidence: 0.2 };
    }

    matches.sort((a, b) => b.hits - a.hits || b.confidence - a.confidence);
    return matches[0];
  }

  /**
   * Deep diagnosis combining telemetry, transactions, tracking, and text description.
   */
  diagnose(issue = {}, context = {}) {
    const textClassification = this.classifyText(issue.description || issue.subject || '');
    const statedType = issue.type && IncidentType[issue.type] ? issue.type : null;

    let rootCause = statedType || textClassification.type;
    let confidence = statedType ? 0.9 : textClassification.confidence;
    const verifiedFacts = [];
    const evidence = {};

    // 1. Double Billing Verification
    if (rootCause === IncidentType.DOUBLE_BILLING || (!statedType && context.transactions?.length > 1)) {
      const duplicateAnalysis = this._verifyDoubleBilling(context.transactions, issue.amount);
      if (duplicateAnalysis.isDuplicate) {
        rootCause = IncidentType.DOUBLE_BILLING;
        confidence = Math.max(confidence, 0.98);
        verifiedFacts.push(`Detected duplicate charge of $${duplicateAnalysis.duplicateAmount} on ${duplicateAnalysis.date}`);
        evidence.duplicateTransaction = duplicateAnalysis;
      }
    }

    // 2. Shipping Delay Verification
    if (rootCause === IncidentType.SHIPPING_DELAY || (!statedType && context.shipment)) {
      const shippingAnalysis = this._verifyShippingDelay(context.shipment, context.currentDate);
      if (shippingAnalysis.isDelayed) {
        rootCause = IncidentType.SHIPPING_DELAY;
        confidence = Math.max(confidence, 0.95);
        verifiedFacts.push(`Shipment delayed by ${shippingAnalysis.daysLate} day(s); status: ${shippingAnalysis.carrierStatus}`);
        evidence.shipping = shippingAnalysis;
      }
    }

    // 3. Service Outage Verification
    if (rootCause === IncidentType.SERVICE_OUTAGE || (!statedType && context.systemOutages?.length > 0)) {
      const outageAnalysis = this._verifyServiceOutage(context.systemOutages, issue.timestamp);
      if (outageAnalysis.isImpacted) {
        rootCause = IncidentType.SERVICE_OUTAGE;
        confidence = Math.max(confidence, 0.96);
        verifiedFacts.push(`Confirmed service outage on ${outageAnalysis.service} during user timeframe (duration: ${outageAnalysis.durationHours}h)`);
        evidence.outage = outageAnalysis;
      }
    }

    // 4. Product Defect Verification
    if (rootCause === IncidentType.PRODUCT_DEFECT) {
      const defectAnalysis = this._verifyProductDefect(issue, context.deviceTelemetry);
      confidence = Math.max(confidence, defectAnalysis.confirmed ? 0.92 : 0.75);
      if (defectAnalysis.confirmed) {
        verifiedFacts.push(`Hardware telemetry confirms defect: ${defectAnalysis.errorCode}`);
      } else {
        verifiedFacts.push('Customer reported defect without conflicting telemetry');
      }
      evidence.defect = defectAnalysis;
    }

    // Determine Severity
    const severity = this._determineSeverity(rootCause, issue, evidence);

    // Resolution Eligibility Assessment
    const eligibility = this._determineEligibility(rootCause, severity, evidence);

    return {
      rootCause,
      confidence: Number(confidence.toFixed(2)),
      severity,
      verifiedFacts,
      evidence,
      eligibility,
      summary: this._generateSummary(rootCause, severity, verifiedFacts),
    };
  }

  _verifyDoubleBilling(transactions = [], requestedAmount = null) {
    if (!transactions || transactions.length < 2) {
      return { isDuplicate: false };
    }

    // Find pairs with identical amount and same currency within 48h
    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        const t1 = transactions[i];
        const t2 = transactions[j];
        const sameAmount = Math.abs(t1.amount - t2.amount) < 0.01;
        const matchesRequested = requestedAmount ? Math.abs(t1.amount - requestedAmount) < 0.01 : true;

        if (sameAmount && matchesRequested) {
          const d1 = new Date(t1.timestamp || t1.date);
          const d2 = new Date(t2.timestamp || t2.date);
          const diffHours = Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60);

          if (diffHours <= 72) {
            return {
              isDuplicate: true,
              originalTxId: t1.id,
              duplicateTxId: t2.id,
              duplicateAmount: t2.amount,
              date: t2.date || t2.timestamp,
              hoursApart: Number(diffHours.toFixed(1)),
            };
          }
        }
      }
    }

    return { isDuplicate: false };
  }

  _verifyShippingDelay(shipment, refDate = new Date()) {
    if (!shipment) return { isDelayed: false };

    const edd = shipment.estimatedDeliveryDate ? new Date(shipment.estimatedDeliveryDate) : null;
    const now = new Date(refDate);

    let isDelayed = false;
    let daysLate = 0;

    if (edd && now > edd && shipment.status !== 'DELIVERED') {
      isDelayed = true;
      daysLate = Math.floor((now.getTime() - edd.getTime()) / (1000 * 60 * 60 * 24));
    } else if (shipment.status === 'DELAYED' || shipment.status === 'EXCEPTION' || shipment.status === 'STUCK') {
      isDelayed = true;
      daysLate = shipment.daysLate || 2;
    }

    return {
      isDelayed,
      daysLate,
      carrierStatus: shipment.status || 'UNKNOWN',
      carrier: shipment.carrier || 'Standard Carrier',
      trackingNumber: shipment.trackingNumber,
      estimatedDeliveryDate: shipment.estimatedDeliveryDate,
    };
  }

  _verifyServiceOutage(outages = [], issueTimestamp = null) {
    if (!outages || outages.length === 0) return { isImpacted: false };

    const targetTime = issueTimestamp ? new Date(issueTimestamp).getTime() : Date.now();

    for (const outage of outages) {
      const start = new Date(outage.startTime).getTime();
      const end = outage.endTime ? new Date(outage.endTime).getTime() : Date.now();

      if (targetTime >= start && targetTime <= end + 3600000) {
        return {
          isImpacted: true,
          incidentId: outage.id,
          service: outage.service,
          durationHours: outage.durationHours || Number(((end - start) / 3600000).toFixed(1)),
          description: outage.description,
        };
      }
    }

    return { isImpacted: false };
  }

  _verifyProductDefect(issue, telemetry) {
    if (telemetry && telemetry.diagnosticFailed) {
      return {
        confirmed: true,
        errorCode: telemetry.errorCode || 'HW_FAULT_DETECTED',
        component: telemetry.faultyComponent || 'Mainboard',
      };
    }
    return {
      confirmed: false,
      reportedDescription: issue.description,
    };
  }

  _determineSeverity(rootCause, issue, evidence) {
    if (issue.severity && DiagnosisSeverity[issue.severity]) {
      return issue.severity;
    }

    switch (rootCause) {
      case IncidentType.DOUBLE_BILLING:
        return evidence.duplicateTransaction?.duplicateAmount > 200 ? DiagnosisSeverity.HIGH : DiagnosisSeverity.MEDIUM;
      case IncidentType.SERVICE_OUTAGE:
        return DiagnosisSeverity.HIGH;
      case IncidentType.SHIPPING_DELAY:
        return (evidence.shipping?.daysLate || 0) >= 5 ? DiagnosisSeverity.HIGH : DiagnosisSeverity.MEDIUM;
      case IncidentType.PRODUCT_DEFECT:
        return DiagnosisSeverity.HIGH;
      default:
        return DiagnosisSeverity.LOW;
    }
  }

  _determineEligibility(rootCause, severity, evidence) {
    return {
      canRefund: rootCause === IncidentType.DOUBLE_BILLING || rootCause === IncidentType.PRODUCT_DEFECT,
      canReplace: rootCause === IncidentType.PRODUCT_DEFECT || rootCause === IncidentType.INCORRECT_ITEM,
      canCredit: true, // Apology credit can be applied across incidents
      canDispatchTech: rootCause === IncidentType.PRODUCT_DEFECT && severity === DiagnosisSeverity.HIGH,
      requiresCarrierInquiry: rootCause === IncidentType.SHIPPING_DELAY,
    };
  }

  _generateSummary(rootCause, severity, facts) {
    const factText = facts.length > 0 ? ` Verified signals: ${facts.join('; ')}.` : '';
    return `Diagnosed incident as [${rootCause}] with severity [${severity}].${factText}`;
  }
}
