/**
 * CashHound Dynamic Settlement NPV Optimizer:
 * Calculates Net Present Value (NPV) comparing immediate discounted cash settlement
 * against prolonged collections risk and cost of capital across 30, 60, and 90-day horizons.
 * Evaluates receivables aging, customer credit risk tiers (ENTERPRISE, STANDARD, HIGH_RISK),
 * and recommends the optimal settlement discount percentage and projected net recovery gain.
 */

import { AgingBuckets, Invoice } from './invoice.js';

export const CustomerRiskTier = Object.freeze({
  ENTERPRISE: 'ENTERPRISE',
  STANDARD: 'STANDARD',
  HIGH_RISK: 'HIGH_RISK',
});

/**
 * Historical recovery probabilities across aging buckets and customer risk tiers.
 */
export const RECOVERY_PROBABILITIES = Object.freeze({
  current: Object.freeze({ ENTERPRISE: 0.99, STANDARD: 0.95, HIGH_RISK: 0.85 }),
  '30+': Object.freeze({ ENTERPRISE: 0.92, STANDARD: 0.82, HIGH_RISK: 0.65 }),
  '60+': Object.freeze({ ENTERPRISE: 0.80, STANDARD: 0.65, HIGH_RISK: 0.45 }),
  '90+': Object.freeze({ ENTERPRISE: 0.60, STANDARD: 0.40, HIGH_RISK: 0.20 }),
});

/**
 * Standard horizon recovery probability matrix for 30, 60, and 90 day future wait periods.
 */
export const HORIZON_RECOVERY_PROBABILITIES = Object.freeze({
  [CustomerRiskTier.ENTERPRISE]: Object.freeze({ 30: 0.98, 60: 0.95, 90: 0.90 }),
  [CustomerRiskTier.STANDARD]: Object.freeze({ 30: 0.90, 60: 0.82, 90: 0.72 }),
  [CustomerRiskTier.HIGH_RISK]: Object.freeze({ 30: 0.78, 60: 0.60, 90: 0.42 }),
});

export class SettlementNpvOptimizer {
  /**
   * @param {number|Object} [config=0.10] - Annual cost of capital (e.g. 0.10 for 10%) or options config
   */
  constructor(config = 0.10) {
    let coc = 0.10;
    if (typeof config === 'number') {
      coc = config;
    } else if (config && typeof config === 'object') {
      coc = config.annualCostOfCapital ?? config.costOfCapital ?? 0.10;
    }
    if (typeof coc === 'number' && coc > 1) {
      coc = coc / 100;
    }
    this.annualCostOfCapital = Number.isFinite(coc) && coc >= 0 ? coc : 0.10;
    this.costOfCapital = this.annualCostOfCapital;
    this.defaultHorizons = [30, 60, 90];
  }

  /**
   * Normalizes customer risk tier input into ENTERPRISE | STANDARD | HIGH_RISK.
   * @param {string} [tier='STANDARD']
   * @returns {string}
   */
  normalizeRiskTier(tier) {
    if (!tier || typeof tier !== 'string') return CustomerRiskTier.STANDARD;
    const clean = tier.trim().toUpperCase().replace(/[-_\s]+/g, '_');
    if (clean === 'ENTERPRISE' || clean === 'VIP') return CustomerRiskTier.ENTERPRISE;
    if (clean === 'HIGH_RISK' || clean === 'AT_RISK' || clean === 'HIGH') return CustomerRiskTier.HIGH_RISK;
    return CustomerRiskTier.STANDARD;
  }

  /**
   * Calculates time-value discount factor: 1 / (1 + r)^(days / 365)
   * @param {number} days
   * @param {number} [rate]
   * @returns {number}
   */
  calculateDiscountFactor(days, rate = this.annualCostOfCapital) {
    const r = typeof rate === 'number' && rate > 1 ? rate / 100 : rate;
    const years = Math.max(0, days) / 365;
    return Number((1 / Math.pow(1 + r, years)).toFixed(6));
  }

  /**
   * Evaluates the NPV of collecting cash today via a settlement discount.
   * @param {number} balance
   * @param {number} discountPercent
   * @returns {{ discountPercent: number, discountAmount: number, settlementCashToday: number, npvToday: number }}
   */
  calculateNpvToday(balance, discountPercent) {
    if (typeof balance !== 'number' || balance <= 0 || !Number.isFinite(balance)) {
      throw new Error('Balance must be a positive finite number');
    }
    const d = Math.max(0, Math.min(80, discountPercent));
    const discountAmount = Number(((balance * d) / 100).toFixed(2));
    const settlementCashToday = Number((balance - discountAmount).toFixed(2));
    return {
      discountPercent: d,
      discountAmount,
      settlementCashToday,
      npvToday: settlementCashToday,
    };
  }

  /**
   * Calculates the Net Present Value of waiting for recovery over a specified horizon.
   * NPV_wait = balance * recoveryProbability * (1 / (1 + r)^(days / 365))
   *
   * @param {number} balance
   * @param {number} days - Recovery horizon (e.g. 30, 60, 90)
   * @param {string} [customerTier='STANDARD']
   * @param {string} [agingBucket='current']
   * @returns {Object}
   */
  calculateNpvWait(balance, days, customerTier = 'STANDARD', agingBucket = 'current') {
    if (typeof balance !== 'number' || balance <= 0 || !Number.isFinite(balance)) {
      throw new Error('Balance must be a positive finite number');
    }
    const tier = this.normalizeRiskTier(customerTier);
    const discountFactor = this.calculateDiscountFactor(days);

    // Baseline recovery probability for this horizon
    const horizonTable = HORIZON_RECOVERY_PROBABILITIES[tier] || HORIZON_RECOVERY_PROBABILITIES[CustomerRiskTier.STANDARD];
    let baseRecovery = horizonTable[days];
    if (baseRecovery === undefined) {
      // Linear interpolation between 30 and 90 days
      const r30 = horizonTable[30] || 0.90;
      const r90 = horizonTable[90] || 0.70;
      baseRecovery = r30 - ((r30 - r90) / 60) * Math.max(0, days - 30);
    }

    // Adjust recovery probability if already in overdue aging bucket
    let agingMultiplier = 1.0;
    if (agingBucket === '30+') agingMultiplier = 0.90;
    else if (agingBucket === '60+') agingMultiplier = 0.75;
    else if (agingBucket === '90+') agingMultiplier = 0.55;

    const recoveryProbability = Number(Math.max(0.05, Math.min(0.99, baseRecovery * agingMultiplier)).toFixed(4));
    const defaultProbability = Number((1 - recoveryProbability).toFixed(4));
    const expectedRecovery = Number((balance * recoveryProbability).toFixed(2));
    const npvWait = Number((expectedRecovery * discountFactor).toFixed(2));

    return {
      days,
      discountFactor,
      recoveryProbability,
      defaultProbability,
      expectedRecovery,
      npvWait,
    };
  }

  /**
   * Compares recovery NPV across 30, 60, and 90 day horizons.
   * @param {number} balance
   * @param {string} [customerTier='STANDARD']
   * @param {string} [agingBucket='current']
   * @returns {Object}
   */
  compareHorizons(balance, customerTier = 'STANDARD', agingBucket = 'current') {
    const tier = this.normalizeRiskTier(customerTier);
    const horizons = {};
    for (const d of [30, 60, 90]) {
      horizons[d] = this.calculateNpvWait(balance, d, tier, agingBucket);
    }
    return horizons;
  }

  /**
   * Evaluates outstanding invoice aging, customer risk tier (ENTERPRISE, STANDARD, HIGH_RISK),
   * and cost of capital to calculate the Net Present Value (NPV) of collecting cash today
   * via a settlement discount vs waiting for full recovery over 30/60/90 days with default probability risk.
   * Recommends optimal settlement discount and projected net recovery gain.
   *
   * @param {number} balance - Outstanding invoice balance
   * @param {number} daysOverdue - Days past due
   * @param {string} [customerTier='STANDARD'] - 'ENTERPRISE' | 'STANDARD' | 'HIGH_RISK'
   * @param {Object} [options={}]
   * @returns {Object} Settlement plan and NPV comparison
   */
  calculateOptimalSettlement(balance, daysOverdue, customerTier = 'STANDARD', options = {}) {
    if (typeof balance !== 'number' || balance <= 0 || !Number.isFinite(balance)) {
      throw new Error('Balance must be a positive number');
    }

    let bucket = 'current';
    let expectedWaitDays = 15;
    if (daysOverdue > 90) { bucket = '90+'; expectedWaitDays = 90; }
    else if (daysOverdue > 60) { bucket = '60+'; expectedWaitDays = 60; }
    else if (daysOverdue > 30) { bucket = '30+'; expectedWaitDays = 30; }

    const tierKey = this.normalizeRiskTier(customerTier);
    const bucketTable = RECOVERY_PROBABILITIES[bucket] || RECOVERY_PROBABILITIES.current;
    const probability = bucketTable[tierKey] ?? 0.60;
    const defaultProbability = Number((1 - probability).toFixed(4));

    // Time discount factor (discounted cash flow)
    const discountFactor = 1 / Math.pow(1 + this.annualCostOfCapital, expectedWaitDays / 365);
    const expectedValueWaiting = balance * probability * discountFactor;

    // Optimal settlement discount curve based on delinquency aging and risk tier:
    // Base discount: 10% for current, 15% for 30+, 20% for 60+, 25% for 90+
    let recommendedDiscountPercent = 10;
    if (bucket === '90+') recommendedDiscountPercent = 25;
    else if (bucket === '60+') recommendedDiscountPercent = 20;
    else if (bucket === '30+') recommendedDiscountPercent = 15;

    // High risk customers get higher incentive to settle immediately (+5%)
    if (tierKey === CustomerRiskTier.HIGH_RISK) {
      recommendedDiscountPercent += 5;
    }

    const settlementCashToday = balance * (1 - (recommendedDiscountPercent / 100));
    const netRecoveryAdvantage = settlementCashToday - expectedValueWaiting;

    // 30, 60, 90 day recovery horizon breakdown
    const horizons = this.compareHorizons(balance, tierKey, bucket);

    const plan = {
      balance,
      daysOverdue,
      customerTier: tierKey,
      agingBucket: bucket,
      costOfCapital: this.annualCostOfCapital,
      recoveryProbabilityIfWaiting: probability,
      defaultProbabilityIfWaiting: defaultProbability,
      expectedValueWaiting: Number(expectedValueWaiting.toFixed(2)),
      npvWaiting: Number(expectedValueWaiting.toFixed(2)),
      recommendedDiscountPercent,
      optimalDiscountPercentage: recommendedDiscountPercent,
      settlementCashToday: Number(settlementCashToday.toFixed(2)),
      npvToday: Number(settlementCashToday.toFixed(2)),
      netRecoveryAdvantage: Number(netRecoveryAdvantage.toFixed(2)),
      projectedNetRecoveryGain: Number(netRecoveryAdvantage.toFixed(2)),
      shouldOfferSettlement: netRecoveryAdvantage > 0,
      strategicRationale: netRecoveryAdvantage > 0
        ? `Immediate recovery of $${settlementCashToday.toFixed(2)} beats waiting (NPV $${expectedValueWaiting.toFixed(2)}) given ${(defaultProbability * 100).toFixed(0)}% default risk.`
        : `Customer risk profile supports pursuing full balance recovery without early discount.`,
      horizonsBreakdown: {
        30: horizons[30],
        60: horizons[60],
        90: horizons[90],
      },
    };

    return plan;
  }

  /**
   * Convenience evaluation for an Invoice instance.
   * @param {Invoice} invoice
   * @param {Date|string} [asOfDate=new Date()]
   * @returns {Object}
   */
  evaluateInvoice(invoice, asOfDate = new Date()) {
    if (!invoice || typeof invoice.getDaysPastDue !== 'function') {
      throw new Error('Expected Invoice instance with getDaysPastDue()');
    }
    const daysPastDue = Math.max(0, invoice.getDaysPastDue(asOfDate));
    const tier = invoice.customer?.tier || CustomerRiskTier.STANDARD;
    return this.calculateOptimalSettlement(invoice.balance, daysPastDue, tier);
  }
}
