import test from 'node:test';
import assert from 'node:assert/strict';
import { RouteDensityOptimizer, FeedbackInterceptor } from '../src/index.js';

test('LocalRoar Route Density: detects proximity matches and applies neighborhood discounts', () => {
  const optimizer = new RouteDensityOptimizer([
    { id: 'job-101', technicianId: 'tech-alpha', postalCode: '94107', street: 'Mission Street' }
  ]);

  // Match by postal code
  const postalMatch = optimizer.evaluateProximity('420 3rd St, San Francisco, CA 94107');
  assert.equal(postalMatch.hasProximityAdvantage, true);
  assert.equal(postalMatch.discountPercentage, 10);
  assert.equal(postalMatch.matchedTechnicianId, 'tech-alpha');

  // Match by street
  const streetMatch = optimizer.evaluateProximity('888 Mission Street, Apt 4B');
  assert.equal(streetMatch.hasProximityAdvantage, true);
  assert.equal(streetMatch.discountPercentage, 15);

  // No match
  const noMatch = optimizer.evaluateProximity('99 Sunset Blvd, Los Angeles, CA 90028');
  assert.equal(noMatch.hasProximityAdvantage, false);
  assert.equal(noMatch.discountPercentage, 0);
});

test('LocalRoar Feedback Interceptor: routes 5-star to Google Reviews and intercepts 2-star privately', () => {
  const interceptor = new FeedbackInterceptor('555-OWNER-HOTLINE');

  // Positive review routes to Google
  const posResult = interceptor.processCustomerReview('book-001', 'Happy Customer', 5, 'Great job fixing the leak!');
  assert.equal(posResult.action, 'ROUTE_TO_PUBLIC_GOOGLE_REVIEW');
  assert.ok(posResult.publicReviewUrl.includes('apex-pros'));

  // Negative review is intercepted privately
  const negResult = interceptor.processCustomerReview('book-002', 'Unhappy Customer', 2, 'Technician was 30 mins late.');
  assert.equal(negResult.action, 'INTERCEPT_PRIVATELY');
  assert.equal(negResult.ticket.status, 'INTERCEPTED_PRIVATE');
  assert.ok(negResult.ticket.ownerAlertMessage.includes('URGENT CUSTOMER ALERT'));
  assert.equal(interceptor.interceptedTickets.length, 1);
});
