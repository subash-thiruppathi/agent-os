import { LeadEngine } from './lead-engine.js';
import { BookingRouter } from './booking-router.js';
import { ReviewBooster } from './review-booster.js';

/**
 * LocalRoar Agent: 24/7 Autonomous operator for local business growth.
 */
export class LocalRoarAgent {
  constructor(businessName = 'LocalPro') {
    this.businessName = businessName;
    this.leadEngine = new LeadEngine();
    this.bookingRouter = new BookingRouter();
    this.reviewBooster = new ReviewBooster();
    this.history = [];
  }

  handleInquiry(inquiryText, channel = 'web') {
    const lead = this.leadEngine.parseInquiry(inquiryText, channel);
    this.history.push({ type: 'LEAD_RECEIVED', lead, timestamp: new Date().toISOString() });

    if (!lead.serviceKey) {
      return {
        action: 'CLARIFY',
        reply: `Hello! We'd love to help you. Could you let us know what service you require (e.g., plumbing, electrical, hvac)?`
      };
    }

    return {
      action: 'QUOTE_AND_BOOK',
      lead,
      suggestedReply: `Thanks for contacting ${this.businessName}! Our estimated rate for ${lead.serviceName} is $${(lead.estimatedAmount / 100).toFixed(2)}. Would you like to schedule an appointment?`
    };
  }

  confirmBooking(customerName, slot, serviceKey, estimatedAmount) {
    const booking = this.bookingRouter.bookSlot({
      customerName,
      slot,
      serviceKey,
      estimatedAmount
    });

    this.history.push({ type: 'BOOKING_CONFIRMED', booking, timestamp: new Date().toISOString() });

    const reviewJob = this.reviewBooster.generateReviewRequest(booking, this.businessName);

    return {
      status: 'CONFIRMED',
      booking,
      scheduledReviewOutreach: reviewJob
    };
  }

  generateWeeklyDigest() {
    const totalLeads = this.history.filter(h => h.type === 'LEAD_RECEIVED').length;
    const confirmedBookings = this.bookingRouter.bookings.length;
    const totalProjectedRevenue = this.bookingRouter.bookings.reduce((sum, b) => sum + (b.estimatedAmount || 0), 0);

    return {
      period: 'Last 7 Days',
      metrics: {
        totalLeadsCaptured: totalLeads,
        bookingsConverted: confirmedBookings,
        conversionRate: totalLeads > 0 ? `${Math.round((confirmedBookings / totalLeads) * 100)}%` : '0%',
        projectedRevenueCents: totalProjectedRevenue,
        projectedRevenueFormatted: `$${(totalProjectedRevenue / 100).toFixed(2)}`
      }
    };
  }
}
