import test from 'node:test';
import assert from 'node:assert/strict';
import { ResolveXAgent, ResolveXMobileAdapter } from '../src/index.js';

test('ResolveX Mobile Adapter: builds mobile outcome cards and tickets', async () => {
  const agent = new ResolveXAgent();
  const mobile = new ResolveXMobileAdapter(agent);

  const card = mobile.getMobileOutcomeCard();
  assert.equal(card.title, 'ResolveX Autonomous Care');
  assert.equal(card.statusBadge, 'ONLINE_24_7');

  const queue = mobile.getMobileTicketQueue();
  assert.equal(Array.isArray(queue), true);
});
