import test from 'node:test';
import assert from 'node:assert/strict';
import { SentinelGovernor, PermissionScope, RiskLevel } from '../src/index.js';

test('SentinelMesh: enforces least-privilege permission boundaries', async () => {
  const sentinel = new SentinelGovernor();
  sentinel.registerAgent('bot-read-only', [PermissionScope.READ_DATA], 0);

  // Read should succeed
  const readResult = await sentinel.runStep(
    'bot-read-only',
    'fetch_customer',
    PermissionScope.READ_DATA,
    { customerId: 'cust-1' },
    async (p) => ({ id: p.customerId, name: 'Alice' })
  );
  assert.equal(readResult.status, 'EXECUTED');
  assert.equal(readResult.result.name, 'Alice');

  // Attempting write without permission should be rejected
  await assert.rejects(async () => {
    await sentinel.runStep(
      'bot-read-only',
      'update_customer',
      PermissionScope.WRITE_DATA,
      { customerId: 'cust-1' },
      async () => ({ ok: true })
    );
  }, /missing required scope/);
});

test('SentinelMesh: enforces financial spending limits with human-in-the-loop gate', async () => {
  const sentinel = new SentinelGovernor();
  sentinel.registerAgent('refund-bot', [PermissionScope.FINANCIAL_TRANSACTION], 5000);

  // $30 refund executes automatically
  const lowRefund = await sentinel.runStep(
    'refund-bot',
    'process_refund',
    PermissionScope.FINANCIAL_TRANSACTION,
    { amount: 3000 },
    async (p) => ({ refunded: p.amount })
  );
  assert.equal(lowRefund.status, 'EXECUTED');

  // $150 refund halts for human approval
  const highRefund = await sentinel.runStep(
    'refund-bot',
    'process_refund',
    PermissionScope.FINANCIAL_TRANSACTION,
    { amount: 15000 },
    async () => ({ refunded: true })
  );
  assert.equal(highRefund.status, 'APPROVAL_REQUIRED');
  assert.equal(highRefund.gate, 'HUMAN_IN_THE_LOOP');
});

test('SentinelMesh Security: blocks negative amounts and type-coercion bypass attempts', async () => {
  const sentinel = new SentinelGovernor();
  sentinel.registerAgent('exploit-test-bot', [PermissionScope.FINANCIAL_TRANSACTION], 5000);

  // Negative amount bypass attempt
  await assert.rejects(async () => {
    await sentinel.runStep(
      'exploit-test-bot',
      'drain_funds',
      PermissionScope.FINANCIAL_TRANSACTION,
      { amount: -50000 },
      async () => ({ drained: true })
    );
  }, /Invalid transaction amount/);

  // String coercion attempt
  await assert.rejects(async () => {
    await sentinel.runStep(
      'exploit-test-bot',
      'drain_funds',
      PermissionScope.FINANCIAL_TRANSACTION,
      { amount: '50000' },
      async () => ({ drained: true })
    );
  }, /Invalid transaction amount/);

  // NaN / Infinity attempt
  await assert.rejects(async () => {
    await sentinel.runStep(
      'exploit-test-bot',
      'drain_funds',
      PermissionScope.FINANCIAL_TRANSACTION,
      { amount: NaN },
      async () => ({ drained: true })
    );
  }, /Invalid transaction amount/);
});

test('SentinelMesh: trips kill-switch on repeated failures and maintains tamper-evident audit ledger', async () => {
  const sentinel = new SentinelGovernor();
  sentinel.registerAgent('unstable-bot', [PermissionScope.READ_DATA]);

  // Trigger 3 failures
  for (let i = 0; i < 3; i++) {
    try {
      await sentinel.runStep(
        'unstable-bot',
        'risky_query',
        PermissionScope.READ_DATA,
        {},
        async () => { throw new Error('Crash in tool'); }
      );
    } catch {
      // Expected
    }
  }

  // Next call should be immediately blocked by kill switch
  await assert.rejects(async () => {
    await sentinel.runStep(
      'unstable-bot',
      'safe_query',
      PermissionScope.READ_DATA,
      {},
      async () => ({ safe: true })
    );
  }, /quarantined by kill-switch/);

  // Check audit ledger cryptographic integrity
  assert.equal(sentinel.sandbox.verifyLedgerIntegrity(), true);
  const auditLogs = sentinel.getAuditTrail('unstable-bot');
  assert.ok(auditLogs.length >= 4);

  // Attempting in-memory mutation of audit block should fail
  assert.throws(() => {
    auditLogs[0].status = 'HACKED';
  }, /Cannot assign to read only property/);
});
