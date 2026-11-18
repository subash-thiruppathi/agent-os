import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalRoarAgent, LocalRoarMobileAdapter } from '../src/index.js';

test('LocalRoar Mobile Adapter: formats mobile growth outcome cards', () => {
  const agent = new LocalRoarAgent('Prime HVAC');
  const mobile = new LocalRoarMobileAdapter(agent);

  const card = mobile.getMobileOutcomeCard();
  assert.equal(card.title, 'LocalRoar Growth Engine');
  assert.equal(card.statusBadge, 'ONLINE_24_7');
});
