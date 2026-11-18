import test from 'node:test';
import assert from 'node:assert/strict';
import { BillNegotiator, BrowserCancellationPlanner } from '../src/index.js';

test('OmniLife Bill Negotiator: analyzes telecom bill and generates negotiation battlecard', () => {
  const negotiator = new BillNegotiator();
  const bill = {
    provider: 'Comcast Xfinity',
    category: 'internet_fiber',
    currentMonthlyCents: 9500, // $95/mo vs $55 benchmark
    tenureMonths: 24
  };

  const analysis = negotiator.analyzeBill(bill);
  assert.equal(analysis.hasSavingsOpportunity, true);
  // (9500 - 5500) * 12 = 48000 cents ($480/yr)
  assert.equal(analysis.annualSavingsCents, 48000);
  assert.equal(analysis.battlecard.projectedAnnualSavingsFormatted, '$480.00');
  assert.ok(analysis.battlecard.recommendedScript.includes('loyalty discounts'));
});

test('OmniLife Cancellation Planner: builds automated navigation graph to bypass retention steps', () => {
  const planner = new BrowserCancellationPlanner();
  const plan = planner.buildNavigationGraph('Gym Fitness', 'member-10294');

  assert.equal(plan.totalSteps, 6);
  assert.equal(plan.executionPlan[3].action, 'DISMISS_RETENTION_OFFERS');
  assert.equal(plan.executionPlan[4].action, 'CONFIRM_FINAL_TERMINATION');
});
