import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentSelfHealer, FaultSignature } from '../src/self-healer.js';

test('AgentSelfHealer: recovers transient network errors via exponential backoff retry', async () => {
  const healer = new AgentSelfHealer({ maxRetries: 2, baseDelayMs: 10 });
  let attempts = 0;

  const result = await healer.executeWithSelfHealing('stripe_charge', async () => {
    attempts++;
    if (attempts < 2) {
      throw new Error('ETIMEDOUT: Connection reset by peer');
    }
    return { charged: true, txId: 'tx_retry_success' };
  });

  assert.equal(result.status, 'RECOVERED_VIA_RETRY');
  assert.equal(result.attempts, 2);
  assert.equal(result.result.charged, true);
});

test('AgentSelfHealer: automatically fails over to secondary rail when primary rail is down', async () => {
  const healer = new AgentSelfHealer({ maxRetries: 1, baseDelayMs: 10 });

  const primaryStripeFn = async () => {
    throw new Error('503 Service Unavailable: Primary payment rail outage');
  };

  const secondaryAchRail = {
    name: 'ACH_DIRECT_FALLBACK',
    fn: async () => ({ settledVia: 'ACH', reference: 'ach_backup_ref_992' })
  };

  const outcome = await healer.executeWithSelfHealing(
    'process_payment',
    primaryStripeFn,
    [secondaryAchRail]
  );

  assert.equal(outcome.status, 'RECOVERED_VIA_FAILOVER');
  assert.equal(outcome.railUsed, 'ACH_DIRECT_FALLBACK');
  assert.equal(outcome.result.settledVia, 'ACH');
  assert.ok(outcome.faultsOvercome.length >= 2);
});
