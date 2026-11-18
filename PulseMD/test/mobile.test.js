import test from 'node:test';
import assert from 'node:assert/strict';
import { PulseMDAgent, PulseMDMobileAdapter } from '../src/index.js';

test('PulseMD Mobile Adapter: formats mobile clinical outcome cards', () => {
  const agent = new PulseMDAgent();
  const mobile = new PulseMDMobileAdapter(agent);

  const card = mobile.getMobileOutcomeCard();
  assert.equal(card.title, 'PulseMD Clinical Operations');
  assert.equal(card.statusBadge, 'CLINICIAN_OVERSIGHT_ACTIVE');
});
