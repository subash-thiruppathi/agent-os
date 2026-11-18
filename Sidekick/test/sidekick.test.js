import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldAgent, reportSchema, EvidenceRegistry } from '../src/index.js';

test('Sidekick: blocks transition until report, checklist, customer sign-off and evidence exist', () => {
  // Missing report
  assert.equal(fieldAgent.next({}).wait, 'in_progress');

  // Incomplete checklist
  const partial = { checklistComplete: false, customerAcknowledged: true, amount: 150000 };
  assert.equal(fieldAgent.next({ report: partial, evidence: [] }).wait, 'evidence_review');

  // Unresolved report
  const unresolved = { checklistComplete: true, customerAcknowledged: true, amount: 150000, unresolved: true };
  assert.equal(fieldAgent.next({ report: unresolved, evidence: ['ev-1'] }).wait, 'blocked');

  // Complete and verified
  const complete = { checklistComplete: true, customerAcknowledged: true, amount: 150000, unresolved: false };
  assert.equal(fieldAgent.next({ report: complete, evidence: ['ev-1'] }).transition, 'settlement');
});

test('Sidekick: evidence registry verifies job association', () => {
  const registry = new EvidenceRegistry();
  const ev1 = registry.register('tenant-1', 'job-100', 'repaired belt photo', 'tech-1');
  assert.ok(ev1.id);
  assert.equal(registry.validateJobEvidence('tenant-1', 'job-100', [ev1.id]), true);

  // Cross-job evidence validation fails
  assert.throws(
    () => registry.validateJobEvidence('tenant-1', 'job-999', [ev1.id]),
    /not registered/
  );
});
