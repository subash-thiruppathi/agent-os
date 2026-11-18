/**
 * ResolveX Resolution Policy Engine
 * Governs thresholds, warranty validation, replacement criteria,
 * voucher/credit multipliers, risk evaluation, and human-in-the-loop triggers.
 */

export const CustomerTier = Object.freeze({
  STANDARD: 'STANDARD',
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
  PLATINUM: 'PLATINUM',
});

export const IssueSeverity = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const DEFAULT_POLICY_CONFIG = Object.freeze({
  autonomousRefundLimit: 100.0,
  maxRefundLimit: 1500.0,
  standardReturnWindowDays: 30,
  standardWarrantyDays: 365,
  maxAutonomousReplacementsPerYear: 2,
  maxAutonomousRiskScore: 0.35,
  tierVoucherMultipliers: {
    [CustomerTier.STANDARD]: 1.0,
    [CustomerTier.BRONZE]: 1.1,
    [CustomerTier.SILVER]: 1.25,
    [CustomerTier.GOLD]: 1.5,
    [CustomerTier.PLATINUM]: 2.0,
  },
  severityBaseCredits: {
    [IssueSeverity.LOW]: 10.0,
    [IssueSeverity.MEDIUM]: 25.0,
    [IssueSeverity.HIGH]: 50.0,
    [IssueSeverity.CRITICAL]: 100.0,
  },
});

export class PolicyEngine {
  constructor(customConfig = {}) {
    this.config = {
      ...DEFAULT_POLICY_CONFIG,
      ...customConfig,
      tierVoucherMultipliers: {
        ...DEFAULT_POLICY_CONFIG.tierVoucherMultipliers,
        ...(customConfig.tierVoucherMultipliers || {}),
      },
      severityBaseCredits: {
        ...DEFAULT_POLICY_CONFIG.severityBaseCredits,
        ...(customConfig.severityBaseCredits || {}),
      },
    };
  }

  /**
   * Validate warranty or return window against reference date.
   */
  validateWarranty({ purchaseDate, warrantyDays = this.config.standardWarrantyDays, referenceDate = new Date() }) {
    if (!purchaseDate) {
      return {
        valid: false,
        daysSincePurchase: null,
        remainingDays: 0,
        isExpired: true,
        reason: 'Missing purchase date',
      };
    }

    const pDate = new Date(purchaseDate);
    const refDate = new Date(referenceDate);
    const msDiff = refDate.getTime() - pDate.getTime();
    const daysSincePurchase = Math.floor(msDiff / (1000 * 60 * 60 * 24));

    if (daysSincePurchase < 0) {
      return {
        valid: false,
        daysSincePurchase,
        remainingDays: 0,
        isExpired: false,
        reason: 'Purchase date is in the future',
      };
    }

    const remainingDays = warrantyDays - daysSincePurchase;
    const isExpired = remainingDays < 0;

    return {
      valid: !isExpired,
      daysSincePurchase,
      remainingDays: Math.max(0, remainingDays),
      isExpired,
      reason: isExpired
        ? `Warranty expired ${Math.abs(remainingDays)} day(s) ago (Window: ${warrantyDays} days)`
        : `Within warranty period (${remainingDays} days remaining)`,
    };
  }

  /**
   * Evaluate customer risk and fraud indicators.
   */
  evaluateRisk({ customerProfile = {}, incidentHistory = [] }) {
    const flags = [];
    let riskScore = 0.05; // Baseline trust

    const accountAgeDays = customerProfile.accountAgeDays ?? 180;
    if (accountAgeDays < 14) {
      riskScore += 0.25;
      flags.push('New account (<14 days)');
    } else if (accountAgeDays < 30) {
      riskScore += 0.1;
      flags.push('Young account (<30 days)');
    }

    const pastClaims = incidentHistory.filter((i) => i.resolvedWith === 'REFUND' || i.resolvedWith === 'REPLACEMENT');
    if (pastClaims.length >= 4) {
      riskScore += 0.35;
      flags.push(`High claim frequency (${pastClaims.length} prior claims)`);
    } else if (pastClaims.length >= 2) {
      riskScore += 0.15;
      flags.push(`Multiple past claims (${pastClaims.length})`);
    }

    if (customerProfile.flaggedForAbuse) {
      riskScore += 0.5;
      flags.push('Account previously flagged for abuse review');
    }

    if (customerProfile.chargebackCount && customerProfile.chargebackCount > 0) {
      riskScore += 0.4;
      flags.push(`Chargeback history detected (${customerProfile.chargebackCount})`);
    }

    riskScore = Math.min(1.0, Math.max(0.0, Number(riskScore.toFixed(2))));

    let riskLevel = 'LOW';
    if (riskScore >= 0.6) {
      riskLevel = 'HIGH';
    } else if (riskScore >= 0.3) {
      riskLevel = 'MEDIUM';
    }

    const allowsAutonomousAction = riskScore <= this.config.maxAutonomousRiskScore;

    return {
      riskScore,
      riskLevel,
      flagExceptions: flags,
      allowsAutonomousAction,
    };
  }

  /**
   * Validate refund eligibility and whether it can proceed autonomously.
   */
  validateRefund({
    amount,
    orderTotal = null,
    customerProfile = {},
    incidentHistory = [],
    isSpecialException = false,
  }) {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return {
        allowed: false,
        allowedAutonomous: false,
        requiresApproval: false,
        reason: 'Refund amount must be a positive number',
      };
    }

    if (orderTotal !== null && amount > orderTotal + 0.001) {
      return {
        allowed: false,
        allowedAutonomous: false,
        requiresApproval: true,
        reason: `Refund amount ($${amount}) exceeds total order value ($${orderTotal})`,
      };
    }

    if (amount > this.config.maxRefundLimit) {
      return {
        allowed: false,
        allowedAutonomous: false,
        requiresApproval: true,
        reason: `Refund amount ($${amount}) exceeds maximum allowable system limit ($${this.config.maxRefundLimit})`,
      };
    }

    const risk = this.evaluateRisk({ customerProfile, incidentHistory });

    if (!risk.allowsAutonomousAction) {
      return {
        allowed: true,
        allowedAutonomous: false,
        requiresApproval: true,
        reason: `Customer risk level (${risk.riskLevel}, score ${risk.riskScore}) requires human approval: ${risk.flagExceptions.join(', ')}`,
        risk,
      };
    }

    if (isSpecialException) {
      return {
        allowed: true,
        allowedAutonomous: false,
        requiresApproval: true,
        reason: 'Special policy exception flagged for supervisor review',
        risk,
      };
    }

    if (amount <= this.config.autonomousRefundLimit) {
      return {
        allowed: true,
        allowedAutonomous: true,
        requiresApproval: false,
        reason: `Amount ($${amount}) within autonomous threshold ($${this.config.autonomousRefundLimit})`,
        risk,
      };
    }

    return {
      allowed: true,
      allowedAutonomous: false,
      requiresApproval: true,
      reason: `Amount ($${amount}) exceeds autonomous refund threshold ($${this.config.autonomousRefundLimit}); requires agent approval`,
      risk,
    };
  }

  /**
   * Validate product replacement request.
   */
  validateReplacement({
    product = {},
    purchaseDate,
    stockAvailable = true,
    customerProfile = {},
    incidentHistory = [],
  }) {
    if (!stockAvailable) {
      return {
        eligible: false,
        allowedAutonomous: false,
        requiresApproval: true,
        reason: 'Item is out of stock; alternate resolution or backorder review required',
      };
    }

    const warranty = this.validateWarranty({
      purchaseDate,
      warrantyDays: product.warrantyDays || this.config.standardWarrantyDays,
    });

    if (!warranty.valid) {
      return {
        eligible: false,
        allowedAutonomous: false,
        requiresApproval: true,
        reason: `Product is outside warranty period: ${warranty.reason}`,
        warranty,
      };
    }

    const risk = this.evaluateRisk({ customerProfile, incidentHistory });
    const pastReplacements = incidentHistory.filter((i) => i.resolvedWith === 'REPLACEMENT');

    if (pastReplacements.length >= this.config.maxAutonomousReplacementsPerYear) {
      return {
        eligible: true,
        allowedAutonomous: false,
        requiresApproval: true,
        reason: `Customer exceeded autonomous replacement frequency limit (${pastReplacements.length}/${this.config.maxAutonomousReplacementsPerYear})`,
        risk,
        warranty,
      };
    }

    if (!risk.allowsAutonomousAction) {
      return {
        eligible: true,
        allowedAutonomous: false,
        requiresApproval: true,
        reason: `Customer risk profile requires human approval for replacement: ${risk.flagExceptions.join(', ')}`,
        risk,
        warranty,
      };
    }

    return {
      eligible: true,
      allowedAutonomous: true,
      requiresApproval: false,
      reason: 'Valid warranty, item in stock, and risk criteria satisfied for autonomous replacement',
      risk,
      warranty,
    };
  }

  /**
   * Calculate apology voucher or credit based on severity and loyalty tier.
   */
  calculateApologyCredit({ severity = IssueSeverity.MEDIUM, customerTier = CustomerTier.STANDARD, customBase = null }) {
    const tier = customerTier.toUpperCase();
    const multiplier = this.config.tierVoucherMultipliers[tier] ?? 1.0;
    const base = customBase !== null
      ? customBase
      : (this.config.severityBaseCredits[severity] ?? this.config.severityBaseCredits[IssueSeverity.MEDIUM]);

    const finalAmount = Number((base * multiplier).toFixed(2));

    return {
      amount: finalAmount,
      currency: 'USD',
      customerTier: tier,
      multiplier,
      severity,
      breakdown: `Base $${base} x ${multiplier} (${tier} tier) = $${finalAmount}`,
    };
  }
}
