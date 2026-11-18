import test from 'node:test';
import assert from 'node:assert/strict';
import { CashHoundAgent, Invoice, CashHoundMobileAdapter } from '../src/index.js';

test('CashHound Mobile Adapter: formats mobile outcome cards and approval stack', () => {
  const agent = new CashHoundAgent();
  const inv = new Invoice({
    id: 'INV-MOB-01',
    customer: { name: 'Acme Mobile', email: 'acme@example.com' },
    amount: 6000,
    dueDate: '2026-10-01'
  });

  agent.registerInvoice(inv);
  agent.runCycle('2026-11-15T00:00:00Z');

  const mobile = new CashHoundMobileAdapter(agent);
  const card = mobile.getMobileOutcomeCard();
  assert.equal(card.title, 'CashHound Autonomous Collections');
  assert.equal(card.approvalsPending, 1);

  const stack = mobile.getMobileApprovalStack();
  assert.equal(stack.length, 1);
  assert.ok(stack[0].amountFormatted.includes('6000'));
});
