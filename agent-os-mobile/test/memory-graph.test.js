import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentMemoryGraph, MemoryPrivacyTier } from '../src/memory-graph.js';

test('AgentMemoryGraph: records facts and enforces privacy partitions across agents', () => {
  const graph = new AgentMemoryGraph();

  // PulseMD records confidential medical allergy
  graph.recordFact({
    entityId: 'cust-john-doe',
    factType: 'CLINICAL_ALLERGY',
    factKey: 'documented_allergies',
    factValue: ['penicillin', 'sulfa'],
    sourceAgent: 'pulsemd',
    privacyTier: MemoryPrivacyTier.RESTRICTED_PHI
  });

  // CashHound records commercial payment habit
  graph.recordFact({
    entityId: 'cust-john-doe',
    factType: 'PAYMENT_HABIT',
    factKey: 'prefers_ach_auto_pay',
    factValue: true,
    sourceAgent: 'cashhound',
    privacyTier: MemoryPrivacyTier.CONFIDENTIAL
  });

  // LocalRoar queries customer: must NOT see RESTRICTED_PHI or CONFIDENTIAL facts
  const localRoarView = graph.queryMemories('cust-john-doe', 'localroar');
  assert.equal(localRoarView.length, 0);

  // CashHound queries customer: sees CONFIDENTIAL, but NOT RESTRICTED_PHI (medical privacy preserved!)
  const cashHoundView = graph.queryMemories('cust-john-doe', 'cashhound');
  assert.equal(cashHoundView.length, 1);
  assert.equal(cashHoundView[0].factKey, 'prefers_ach_auto_pay');

  // PulseMD queries customer: sees RESTRICTED_PHI
  const pulseMdView = graph.queryMemories('cust-john-doe', 'pulsemd');
  assert.equal(pulseMdView.some(f => f.factKey === 'documented_allergies'), true);
});

test('AgentMemoryGraph: supersedes outdated facts when new observations arrive', () => {
  const graph = new AgentMemoryGraph();

  graph.recordFact({
    entityId: 'cust-acme',
    factKey: 'billing_address',
    factValue: '100 Old Street',
    sourceAgent: 'localroar',
    privacyTier: MemoryPrivacyTier.ORGANIZATION
  });

  // Update address
  graph.recordFact({
    entityId: 'cust-acme',
    factKey: 'billing_address',
    factValue: '200 New Boulevard',
    sourceAgent: 'cashhound',
    privacyTier: MemoryPrivacyTier.ORGANIZATION
  });

  const activeMemories = graph.queryMemories('cust-acme', 'cashhound');
  assert.equal(activeMemories.length, 1);
  assert.equal(activeMemories[0].factValue, '200 New Boulevard');
});
