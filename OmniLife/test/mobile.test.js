import test from 'node:test';
import assert from 'node:assert/strict';
import { OmniLifeAgent, OmniLifeMobileAdapter } from '../src/index.js';

test('OmniLife Mobile Adapter: formats mobile life OS cards', () => {
  const agent = new OmniLifeAgent('Jane');
  const mobile = new OmniLifeMobileAdapter(agent);

  const card = mobile.getMobileOutcomeCard();
  assert.equal(card.title, 'OmniLife Operating System');
  assert.equal(card.statusBadge, 'GUARDIAN_ONLINE');
});
