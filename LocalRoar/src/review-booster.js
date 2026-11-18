/**
 * LocalRoar Review Booster: Automatically triggers personalized post-job review outreach.
 */

export class ReviewBooster {
  generateReviewRequest(booking, businessName = 'Prime Services') {
    return {
      recipient: booking.customerName,
      channel: 'sms',
      message: `Hi ${booking.customerName}, thanks for choosing ${businessName} for your ${booking.serviceKey || 'recent service'}! How did we do? Please leave us a quick review: https://review.localroar.app/${booking.id}`,
      scheduledDelayMinutes: 120 // 2 hours after completion
    };
  }

  processFeedback(rating, comments = '') {
    const isPositive = rating >= 4;
    return {
      rating,
      sentiment: isPositive ? 'POSITIVE' : 'NEEDS_ATTENTION',
      escalateToOwner: !isPositive,
      suggestedAction: isPositive ? 'POST_TO_GOOGLE_BUSINESS' : 'NOTIFY_OWNER_IMMEDIATELY'
    };
  }
}
