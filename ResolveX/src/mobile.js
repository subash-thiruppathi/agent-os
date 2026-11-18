/**
 * ResolveX Mobile Adapter: Provides mobile outcome cards & supervisor ticket queues.
 */

export class ResolveXMobileAdapter {
  constructor(agent) {
    this.agent = agent;
  }

  getMobileOutcomeCard() {
    const closed = this.agent.auditLog.filter(l => l.action === 'RESOLUTION_EXECUTED').length;
    const tickets = this.agent.getPendingApprovals();

    return {
      title: 'ResolveX Autonomous Care',
      outcomeMetric: `${closed} Resolved`,
      pendingSupervisorTickets: tickets.length,
      statusBadge: 'ONLINE_24_7'
    };
  }

  getMobileTicketQueue() {
    return this.agent.getPendingApprovals().map(t => ({
      id: t.id,
      customerName: t.customer?.name || 'Customer',
      issueType: t.diagnosis?.type || 'Inquiry',
      amountFormatted: t.proposedResolution?.refundAmount ? `$${t.proposedResolution.refundAmount.toFixed(2)}` : null,
      reason: t.escalationReason || 'Supervisor approval threshold reached'
    }));
  }
}
