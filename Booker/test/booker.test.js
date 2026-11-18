import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingAgent, parseIntake, CalendarAdapter } from '../src/index.js';

test('Booker: parses text and evaluates booking policy', () => {
  const note = `
Customer: Rajesh Kumar
Address: 42 Palm Grove Road, Bangalore
Appliance: washing machine
Slot: 2026-12-01T10:00:00+05:30
Estimated charge: ₹1,500
Technician: tech-101
  `;
  const parsed = parseIntake(note);
  assert.equal(parsed.success, true);

  const decision = bookingAgent.next({ input: parsed.candidate });
  assert.equal(decision.tool, 'book');
  assert.equal(decision.permission, 'booking');

  const afterBooking = bookingAgent.next({ input: parsed.candidate, booking: { id: 'b-1' } });
  assert.equal(afterBooking.transition, 'booked');
});

test('Booker: calendar adapter prevents conflicting appointment overlaps', () => {
  const calendar = new CalendarAdapter(90);
  const slot = '2026-12-01T10:00:00.000Z';
  const res1 = calendar.reserve('t1', 'tech-1', slot, 'job-1');
  assert.ok(res1.id);

  assert.throws(
    () => calendar.reserve('t1', 'tech-1', '2026-12-01T10:30:00.000Z', 'job-2'),
    /schedule conflict/
  );
});
