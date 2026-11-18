import { SubscriptionManager } from './subscription-manager.js';
import { ConflictEngine } from './conflict-engine.js';

/**
 * OmniLife Agent: Autonomous Life Operating System with Human-in-the-Loop Safeguards.
 */
export class OmniLifeAgent {
  constructor(userName = 'User') {
    this.userName = userName;
    this.subscriptions = new SubscriptionManager();
    this.conflictEngine = new ConflictEngine();
    this.actionHistory = [];
  }

  evaluateLifeOSStatus(calendarEvents = [], passportExpiry = null, upcomingTripDeparture = null) {
    const dormantSubs = this.subscriptions.findDormantSubscriptions(90);
    const subPlans = dormantSubs.map(s => this.subscriptions.planCancellation(s.id));

    let passportAlert = null;
    if (passportExpiry && upcomingTripDeparture) {
      passportAlert = this.conflictEngine.checkPassportValidity(passportExpiry, upcomingTripDeparture);
    }

    const calendarConflicts = this.conflictEngine.detectCalendarConflicts(calendarEvents);

    return {
      user: this.userName,
      dormantSubscriptions: subPlans,
      passportAlert,
      calendarConflicts,
      pendingApprovals: subPlans.filter(p => p.requiresHumanApproval)
    };
  }

  approveCancellation(subId, approved = true) {
    if (!approved) {
      return { status: 'REJECTED_BY_USER', subId };
    }
    const cancelled = this.subscriptions.cancelSubscription(subId, approved);
    this.actionHistory.push({
      action: 'CANCEL_SUBSCRIPTION',
      subId,
      timestamp: new Date().toISOString()
    });
    return { status: 'CANCELLED_SUCCESSFULLY', subscription: cancelled };
  }
}
