import test from 'node:test';
import assert from 'node:assert/strict';
import { PulseMDAgent, ClinicianAuth } from '../src/index.js';

test('PulseMD: drafts clinical SOAP note, redacts PHI, and gates on verified clinician signature', () => {
  const agent = new PulseMDAgent();
  const encounter = {
    patientId: 'pt-1001',
    chiefComplaint: 'Right knee pain after sports injury. Patient SSN 123-45-6789, Phone 555-123-4567',
    vitals: { bp: '124/82', hr: '76', temp: '98.4F' },
    conversation: 'Patient reports twist while playing soccer 3 days ago. Contact: john@example.com.',
    clinicianName: 'Dr. Sarah Smith, MD'
  };

  const draftResult = agent.processEncounter(encounter);
  assert.equal(draftResult.status, 'AWAITING_CLINICIAN_SIGNATURE');

  // Verify PHI / PII was redacted
  assert.ok(draftResult.draftNote.soap.subjective.includes('[REDACTED_SSN]'));
  assert.ok(draftResult.draftNote.soap.subjective.includes('[REDACTED_PHONE]'));
  assert.ok(draftResult.draftNote.soap.subjective.includes('[REDACTED_EMAIL]'));

  // Attempting to finalize note with no or invalid token should throw
  assert.throws(() => {
    agent.signAndFinalizeNote(draftResult.draftNote.draftId, 'dr-smith-md', {}, 'invalid-token');
  }, /Unauthorized signature attempt/);

  // Generate valid cryptographic signature token
  const validToken = ClinicianAuth.generateToken('dr-smith-md', 'PHYSICIAN');
  const finalized = agent.signAndFinalizeNote(draftResult.draftNote.draftId, 'dr-smith-md', {}, validToken);
  assert.equal(finalized.status, 'FINALIZED_AND_LOCKED');
  assert.equal(finalized.clinicianId, 'dr-smith-md');
  assert.equal(finalized.verifiedRole, 'PHYSICIAN');
});

test('PulseMD Security: rejects forged or mismatched clinician signature tokens', () => {
  const agent = new PulseMDAgent();
  const draft = agent.processEncounter({
    patientId: 'pt-2002',
    chiefComplaint: 'Hypertension check'
  });

  // Token created for another doctor
  const tokenForOtherDoc = ClinicianAuth.generateToken('dr-other-doc', 'PHYSICIAN');
  assert.throws(() => {
    agent.signAndFinalizeNote(draft.draftNote.draftId, 'dr-target-doc', {}, tokenForOtherDoc);
  }, /does not match claimed/);
});

test('PulseMD: flags missing prior-authorization prerequisites for imaging', () => {
  const agent = new PulseMDAgent();

  const incompleteHistory = {
    radiograph_completed: true
  };

  const deficient = agent.evaluatePriorAuth('pt-1001', 'mri_lumbar', incompleteHistory);
  assert.equal(deficient.action, 'FLAG_DEFICIENCY');
  assert.ok(deficient.missing.includes('physical_therapy_completed'));

  const completeHistory = {
    physical_therapy_completed: true,
    conservative_management_6_weeks: true,
    radiograph_completed: true
  };

  const ready = agent.evaluatePriorAuth('pt-1001', 'mri_lumbar', completeHistory);
  assert.equal(ready.action, 'SUBMIT_FOR_CLINICIAN_APPROVAL');
  assert.equal(ready.packet.isCompliant, true);
  assert.equal(ready.packet.cptCode, '72148');
});
