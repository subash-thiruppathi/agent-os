import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileHub, ServerApprovalGateway } from '../src/api.js';

test('AgentOS Mobile Hub: initializes all 6 rocking agent engines', () => {
  assert.ok(mobileHub.cashhound);
  assert.ok(mobileHub.resolvex);
  assert.ok(mobileHub.sentinel);
  assert.ok(mobileHub.localroar);
  assert.ok(mobileHub.pulsemd);
  assert.ok(mobileHub.omnilife);

  const metrics = mobileHub.getGlobalMetrics();
  assert.equal(metrics.activeAgents, 6);
  assert.equal(metrics.systemStatus, 'ALL_SYSTEMS_OPTIMAL');
});

test('AgentOS Mobile Gateway: enforces server-authoritative token validation and blocks replays', () => {
  const gateway = new ServerApprovalGateway();
  const ticket = gateway.generateApprovalTicket('ResolveX', 'ticket-high-refund-01', 35000);

  // First authorization succeeds
  const auth = gateway.verifyAndAuthorizeApproval(ticket, 'SUPERVISOR');
  assert.equal(auth.authorized, true);
  assert.equal(auth.agentName, 'ResolveX');
  assert.equal(auth.amountCents, 35000);

  // Replay attempt fails
  const replay = gateway.verifyAndAuthorizeApproval(ticket, 'SUPERVISOR');
  assert.equal(replay.authorized, false);
  assert.ok(replay.reason.includes('Replay detected'));

  // Tampered ticket fails
  const tampered = ticket.slice(0, -4) + 'abcd';
  const badAuth = gateway.verifyAndAuthorizeApproval(tampered);
  assert.equal(badAuth.authorized, false);
});
