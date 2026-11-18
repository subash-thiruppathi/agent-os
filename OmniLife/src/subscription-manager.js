/**
 * OmniLife Subscription Manager: Audits recurring expenses, detects dormancy, and plans safe cancellation.
 * Hardened to prevent unauthorized contract cancellations without explicit user approval.
 */

export class SubscriptionManager {
  constructor() {
    this.subscriptions = [];
  }

  addSubscription(sub) {
    this.subscriptions.push({
      id: sub.id || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: sub.name,
      monthlyCostCents: sub.monthlyCostCents,
      lastUsedDaysAgo: sub.lastUsedDaysAgo || 0,
      hasEarlyTerminationPenalty: Boolean(sub.hasEarlyTerminationPenalty),
      penaltyAmountCents: sub.penaltyAmountCents || 0,
      status: 'ACTIVE'
    });
  }

  findDormantSubscriptions(dormantThresholdDays = 90) {
    return this.subscriptions.filter(
      s => s.status === 'ACTIVE' && s.lastUsedDaysAgo >= dormantThresholdDays
    );
  }

  planCancellation(subId) {
    const sub = this.subscriptions.find(s => s.id === subId);
    if (!sub) throw new Error(`Subscription ${subId} not found`);

    const annualSavingsCents = sub.monthlyCostCents * 12;

    if (sub.hasEarlyTerminationPenalty) {
      return {
        subscription: sub,
        requiresHumanApproval: true,
        reason: `Early cancellation penalty of $${(sub.penaltyAmountCents / 100).toFixed(2)} applies`,
        projectedNetYearlySavingsCents: annualSavingsCents - sub.penaltyAmountCents,
        action: 'HUMAN_APPROVAL_REQUIRED'
      };
    }

    return {
      subscription: sub,
      requiresHumanApproval: false,
      projectedNetYearlySavingsCents: annualSavingsCents,
      action: 'SAFE_TO_CANCEL'
    };
  }

  // SEC-09: Require explicit approval authorization before cancelling subscriptions with financial penalties
  cancelSubscription(subId, isUserApproved = false) {
    const sub = this.subscriptions.find(s => s.id === subId);
    if (!sub) throw new Error(`Subscription ${subId} not found`);

    if (sub.hasEarlyTerminationPenalty && !isUserApproved) {
      throw new Error(`Cancellation blocked: subscription '${sub.name}' incurs penalty of $${(sub.penaltyAmountCents / 100).toFixed(2)} and demands explicit user authorization.`);
    }

    sub.status = 'CANCELLED';
    sub.cancelledAt = new Date().toISOString();
    return sub;
  }
}
