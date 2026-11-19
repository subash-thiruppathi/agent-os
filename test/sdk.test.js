import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentOSLLMGateway,
  SpeculativeVerifier,
  AgentMemoryGraph,
  MemoryPrivacyTier,
  AgentSelfHealer,
  FaultSignature,
  SpekraTelemetryBridge,
  AgentOSSwarm,
  BiometricController,
  VoiceCockpit,
  SentinelGovernor,
  PermissionScope,
  CashHoundAgent,
  Invoice,
  ResolveXAgent,
  LocalRoarAgent,
  PulseMDAgent,
  OmniLifeAgent,
  parseIntake,
  CalendarAdapter,
  settlementAgent,
  SettlementReconciler,
  fieldAgent,
  EvidenceRegistry
} from '../src/index.js';

test('@spekra.in/agent-os SDK Root Exports', async (t) => {
  await t.test('Core Engine Classes & Enums', () => {
    assert.ok(typeof AgentOSLLMGateway === 'function');
    assert.ok(typeof SpeculativeVerifier === 'function');
    assert.ok(typeof AgentMemoryGraph === 'function');
    assert.equal(MemoryPrivacyTier.RESTRICTED_PHI, 'RESTRICTED_PHI');
    assert.ok(typeof AgentSelfHealer === 'function');
    assert.equal(FaultSignature.RATE_LIMIT_429, 'RATE_LIMIT_429');
    assert.ok(typeof SpekraTelemetryBridge === 'function');
    assert.ok(typeof AgentOSSwarm === 'function');
    assert.ok(typeof BiometricController === 'function');
    assert.ok(typeof VoiceCockpit === 'function');
    assert.ok(typeof SentinelGovernor === 'function');
    assert.equal(PermissionScope.FINANCIAL_TRANSACTION, 'transact:financial');
  });

  await t.test('Domain Agents and Orchestrators', () => {
    assert.ok(typeof CashHoundAgent === 'function');
    assert.ok(typeof Invoice === 'function');
    assert.ok(typeof ResolveXAgent === 'function');
    assert.ok(typeof LocalRoarAgent === 'function');
    assert.ok(typeof PulseMDAgent === 'function');
    assert.ok(typeof OmniLifeAgent === 'function');
    assert.ok(typeof parseIntake === 'function');
    assert.ok(typeof CalendarAdapter === 'function');
    assert.ok(typeof settlementAgent === 'object');
    assert.ok(typeof SettlementReconciler === 'function');
    assert.ok(typeof fieldAgent === 'object');
    assert.ok(typeof EvidenceRegistry === 'function');
  });

  await t.test('SpeculativeVerifier instantiation & check', () => {
    const verifier = new SpeculativeVerifier();
    const result = verifier.verifyAction({
      id: 'act-001',
      amountCents: 5000,
      breakdown: [{ amountCents: 5000 }],
      title: 'Payment Reminder',
      description: 'Friendly settlement reminder'
    });
    assert.equal(result.verified, true);
    assert.equal(result.policyAlignmentScore, 100);
    assert.equal(result.passedSecondPairOfEyes, true);
  });
});
