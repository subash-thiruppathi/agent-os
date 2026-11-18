import test from 'node:test';
import assert from 'node:assert/strict';
import { SpekraTelemetryBridge } from '../src/spekra-bridge.js';

test('SpekraTelemetryBridge: creates W3C trace spans, tracks lifecycle, and computes duration', () => {
  const bridge = new SpekraTelemetryBridge({ environment: 'test' });
  const span = bridge.startSpan({
    name: 'evaluate_invoice_recovery',
    agentName: 'cashhound',
    attributes: { 'invoice.id': 'INV-1094', 'invoice.amount': 8400 }
  });

  assert.equal(typeof span.traceId, 'string');
  assert.equal(span.traceId.length, 32);
  assert.equal(span.agentName, 'cashhound');
  assert.equal(span.status, 'IN_PROGRESS');

  bridge.addSpanEvent(span.spanId, 'SPECULATIVE_VERIFIER_PASSED', { score: 100 });
  const completedSpan = bridge.endSpan(span.spanId, {
    status: 'OK',
    output: { decision: 'PROCEED_DUNNING' }
  });

  assert.equal(completedSpan.status, 'OK');
  assert.equal(typeof completedSpan.durationMs, 'number');
  assert.equal(completedSpan.events.length, 1);
  assert.equal(completedSpan.events[0].name, 'SPECULATIVE_VERIFIER_PASSED');
});

test('SpekraTelemetryBridge: dispatches incident alerts to Spekra on-call queue', () => {
  const bridge = new SpekraTelemetryBridge();
  let emittedAlert = null;
  bridge.on('incident', (alert) => { emittedAlert = alert; });

  const alert = bridge.dispatchIncidentAlert({
    severity: 'CRITICAL',
    faultSignature: 'RATE_LIMIT_429',
    agentName: 'cashhound',
    message: 'Stripe primary rail overwhelmed by 429 rate limit surge',
    context: { consecutiveErrors: 3 }
  });

  assert.ok(alert.alertId.startsWith('INC-'));
  assert.equal(alert.severity, 'CRITICAL');
  assert.equal(alert.status, 'PAGED_TO_ONCALL');
  assert.equal(emittedAlert.alertId, alert.alertId);
});

test('SpekraTelemetryBridge: mirrors SentinelMesh blocks with cryptographic proof tokens', () => {
  const bridge = new SpekraTelemetryBridge();
  const mockBlock = {
    index: 1494,
    hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    agentId: 'resolvex',
    operation: 'AUTONOMOUS_REFUND_APPROVED'
  };

  const record = bridge.mirrorLedgerBlock(mockBlock);
  assert.equal(record.blockIndex, 1494);
  assert.equal(record.hash, mockBlock.hash);
  assert.equal(typeof record.spekraProofToken, 'string');
  assert.equal(record.spekraProofToken.length, 64); // SHA-256 HMAC
});

test('SpekraTelemetryBridge: provides comprehensive fleet snapshot', () => {
  const bridge = new SpekraTelemetryBridge();
  const snapshot = bridge.getTelemetrySnapshot();
  assert.equal(snapshot.spekraHost, 'https://spekra.in');
  assert.equal(snapshot.connected, true);
  assert.equal(typeof snapshot.mirroredLedgerBlocksCount, 'number');
});
