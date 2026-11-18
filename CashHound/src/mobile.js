/**
 * CashHound Mobile ViewModel: Formats mobile outcome cards & approval payloads.
 */

export class CashHoundMobileAdapter {
  constructor(agent) {
    this.agent = agent;
  }

  getMobileOutcomeCard() {
    let totalBalance = 0;
    for (const inv of this.agent.invoices.values()) {
      totalBalance += inv.balance;
    }

    const pending = this.agent.getPendingApprovals();

    return {
      title: 'CashHound Autonomous Collections',
      outcomeMetric: `$${totalBalance.toFixed(2)} Active Pipeline`,
      approvalsPending: pending.length,
      statusBadge: 'COLLECTING_24_7'
    };
  }

  getMobileApprovalStack() {
    return this.agent.getPendingApprovals().map(action => ({
      id: action.id,
      title: `Approve Notice: ${action.customerName || 'Customer'}`,
      summary: action.draftMessage?.subject || action.approvalReasons?.join(', ') || 'Pending approval',
      amountFormatted: action.balance ? `$${action.balance.toFixed(2)}` : null,
      urgency: 'HIGH'
    }));
  }
}
