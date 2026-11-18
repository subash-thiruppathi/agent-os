import test from 'node:test';
import assert from 'node:assert/strict';
import { SentinelGovernor, SentinelMeshMobileAdapter } from '../src/index.js';

test('SentinelMesh Mobile Adapter: formats mobile governance outcome cards', () => {
  const governor = new SentinelGovernor();
  const mobile = new SentinelMeshMobileAdapter(governor);

  const card = mobile.getMobileOutcomeCard();
  assert.equal(card.title, 'SentinelMesh Governance Fabric');
  assert.equal(card.statusBadge, 'ZERO_TRUST_ENFORCED');
});
