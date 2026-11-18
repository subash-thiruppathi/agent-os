/**
 * LocalRoar Mobile Adapter: Formats mobile growth cards and 1-tap quote dispatchers.
 */

export class LocalRoarMobileAdapter {
  constructor(agent) {
    this.agent = agent;
  }

  getMobileOutcomeCard() {
    const digest = this.agent.generateWeeklyDigest();
    return {
      title: 'LocalRoar Growth Engine',
      outcomeMetric: `${digest.metrics.conversionRate} Conversion`,
      revenueProjected: digest.metrics.projectedRevenueFormatted,
      statusBadge: 'ONLINE_24_7'
    };
  }

  getMobileLeadCard(inquiryText, channel = 'sms') {
    return this.agent.handleInquiry(inquiryText, channel);
  }
}
