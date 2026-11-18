import test from 'node:test';
import assert from 'node:assert/strict';
import { OmniLifeAgent } from '../src/index.js';

test('OmniLife: detects dormant subscriptions and enforces approval for penalties', () => {
  const agent = new OmniLifeAgent('Jane');
  agent.subscriptions.addSubscription({
    id: 'sub-gym',
    name: 'Fitness Gym Gold',
    monthlyCostCents: 6000,
    lastUsedDaysAgo: 120,
    hasEarlyTerminationPenalty: true,
    penaltyAmountCents: 5000
  });

  agent.subscriptions.addSubscription({
    id: 'sub-stream',
    name: 'Obsolete Streaming App',
    monthlyCostCents: 1500,
    lastUsedDaysAgo: 95,
    hasEarlyTerminationPenalty: false
  });

  const status = agent.evaluateLifeOSStatus();
  assert.equal(status.dormantSubscriptions.length, 2);
  assert.equal(status.pendingApprovals.length, 1);
  assert.equal(status.pendingApprovals[0].subscription.id, 'sub-gym');

  // User approves cancellation
  const cancelRes = agent.approveCancellation('sub-gym', true);
  assert.equal(cancelRes.status, 'CANCELLED_SUCCESSFULLY');
  assert.equal(cancelRes.subscription.status, 'CANCELLED');
});

test('OmniLife: warns on international passport validity window violation', () => {
  const agent = new OmniLifeAgent('Jane');

  // Trip departure: 2027-01-01, Passport expiry: 2027-02-01 (< 6 months)
  const status = agent.evaluateLifeOSStatus([], '2027-02-01T00:00:00Z', '2027-01-01T00:00:00Z');
  assert.equal(status.passportAlert.compliant, false);
  assert.equal(status.passportAlert.severity, 'CRITICAL');
  assert.equal(status.passportAlert.recommendedAction, 'EXPEDITE_PASSPORT_RENEWAL');
});

test('OmniLife: detects calendar collisions', () => {
  const agent = new OmniLifeAgent('Jane');
  const events = [
    { title: 'Dentist', start: '2026-12-10T10:00:00Z', end: '2026-12-10T11:30:00Z' },
    { title: 'Project Review', start: '2026-12-10T11:00:00Z', end: '2026-12-10T12:00:00Z' }
  ];

  const status = agent.evaluateLifeOSStatus(events);
  assert.equal(status.calendarConflicts.length, 1);
  assert.equal(status.calendarConflicts[0].overlapMinutes, 30);
});

test('OmniLife Security: blocks unapproved cancellation of penalty subscriptions', () => {
  const agent = new OmniLifeAgent('Jane');
  agent.subscriptions.addSubscription({
    id: 'sub-penalty-gym',
    name: 'Hardcore Gym',
    monthlyCostCents: 5000,
    hasEarlyTerminationPenalty: true,
    penaltyAmountCents: 10000
  });

  // Direct cancellation without approval throws error
  assert.throws(() => {
    agent.subscriptions.cancelSubscription('sub-penalty-gym', false);
  }, /demands explicit user authorization/);
});
