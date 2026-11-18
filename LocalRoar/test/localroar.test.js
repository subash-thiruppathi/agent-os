import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalRoarAgent } from '../src/index.js';

test('LocalRoar: parses inbound lead and generates instant quote', () => {
  const agent = new LocalRoarAgent('Apex Plumbing & Heating');
  const inquiry = 'Hi, our pipe burst under the sink! It is urgent, can you come asap? Phone: 555-019-2834';

  const res = agent.handleInquiry(inquiry, 'sms');
  assert.equal(res.action, 'QUOTE_AND_BOOK');
  assert.equal(res.lead.serviceKey, 'plumbing');
  assert.equal(res.lead.isUrgent, true);
  assert.equal(res.lead.customerPhone, '555-019-2834');
  // Plumbing base is 7500, with urgent 1.5x = 11250 cents ($112.50)
  assert.equal(res.lead.estimatedAmount, 11250);
});

test('LocalRoar: books appointment slot and schedules post-service review outreach', () => {
  const agent = new LocalRoarAgent('Apex Plumbing');
  const slot = '2026-12-05T14:00:00Z';

  const booking = agent.confirmBooking('David Miller', slot, 'plumbing', 11250);
  assert.equal(booking.status, 'CONFIRMED');
  assert.equal(booking.booking.customerName, 'David Miller');
  assert.ok(booking.scheduledReviewOutreach.message.includes('Apex Plumbing'));

  // Attempting to book overlapping slot should throw
  assert.throws(() => {
    agent.confirmBooking('Other Customer', slot, 'plumbing', 7500);
  }, /already booked/);
});

test('LocalRoar: produces executive weekly performance metrics digest', () => {
  const agent = new LocalRoarAgent('Apex Plumbing');
  agent.handleInquiry('Need hvac tune-up', 'web');
  agent.handleInquiry('Help with electrical socket', 'web');

  agent.confirmBooking('John Doe', '2026-12-05T10:00:00Z', 'hvac', 12000);

  const digest = agent.generateWeeklyDigest();
  assert.equal(digest.metrics.totalLeadsCaptured, 2);
  assert.equal(digest.metrics.bookingsConverted, 1);
  assert.equal(digest.metrics.conversionRate, '50%');
  assert.equal(digest.metrics.projectedRevenueFormatted, '$120.00');
});

test('LocalRoar Security: blocks calendar denial-of-inventory flood attempts', () => {
  const agent = new LocalRoarAgent('Apex Plumbing');

  // Book 3 slots (allowed limit)
  agent.confirmBooking('Spam Bot', '2026-12-10T10:00:00Z', 'plumbing', 7500);
  agent.confirmBooking('Spam Bot', '2026-12-10T12:00:00Z', 'plumbing', 7500);
  agent.confirmBooking('Spam Bot', '2026-12-10T14:00:00Z', 'plumbing', 7500);

  // 4th slot should throw booking limit exceeded
  assert.throws(() => {
    agent.confirmBooking('Spam Bot', '2026-12-10T16:00:00Z', 'plumbing', 7500);
  }, /Booking limit exceeded/);
});
