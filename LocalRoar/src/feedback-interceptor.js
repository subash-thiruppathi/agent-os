/**
 * LocalRoar Negative Feedback Interceptor: Catches dissatisfied customers privately,
 * triggering immediate owner outreach to defuse complaints before public Google Reviews.
 */

export class FeedbackInterceptor {
  constructor(ownerPhone = '555-901-PROS') {
    this.ownerPhone = ownerPhone;
    this.interceptedTickets = [];
  }

  processCustomerReview(bookingId, customerName, rating, feedbackText = '') {
    const isSatisfied = rating >= 4;

    if (isSatisfied) {
      return {
        action: 'ROUTE_TO_PUBLIC_GOOGLE_REVIEW',
        bookingId,
        customerName,
        rating,
        publicReviewUrl: `https://g.page/r/apex-pros/review?b=${encodeURIComponent(bookingId)}`,
        thankYouMessage: `Thank you so much, ${customerName}! We're thrilled you had a 5-star experience. Would you mind sharing your review on Google? It means the world to our team.`
      };
    }

    // Intercept 1-3 star review privately
    const ticketId = `INT-${Date.now()}`;
    const ticket = {
      ticketId,
      bookingId,
      customerName,
      rating,
      feedbackText,
      status: 'INTERCEPTED_PRIVATE',
      ownerAlertMessage: `🚨 URGENT CUSTOMER ALERT: ${customerName} gave a ${rating}-star rating on Job #${bookingId}. Feedback: "${feedbackText}". Call customer immediately at priority dispatch.`,
      customerApologyMessage: `We're deeply sorry to hear your service was not 100% satisfactory, ${customerName}. Our owner has been alerted and will personally call you within 30 minutes to make this right.`,
      interceptedAt: new Date().toISOString()
    };

    this.interceptedTickets.push(ticket);

    return {
      action: 'INTERCEPT_PRIVATELY',
      ticket
    };
  }
}
