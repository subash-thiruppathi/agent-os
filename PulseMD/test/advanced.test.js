import test from 'node:test';
import assert from 'node:assert/strict';
import { ClinicalSafetyGuard, AmbientMedicalScribe } from '../src/index.js';

test('PulseMD Safety Guard: detects fatal allergy conflicts and drug contraindications', () => {
  const guard = new ClinicalSafetyGuard();

  // Test 1: Allergy alert
  const allergyProfile = {
    allergies: ['penicillin'],
    currentMedications: []
  };
  const allergyCheck = guard.evaluateSafety(['Amoxicillin-Penicillin VK'], allergyProfile);
  assert.equal(allergyCheck.safeToPrescribe, false);
  assert.equal(allergyCheck.alerts[0].type, 'ALLERGY_ALERT');

  // Test 2: NSAID with active peptic ulcer disease
  const ulcerProfile = {
    allergies: [],
    existingConditions: ['peptic_ulcer'],
    currentMedications: []
  };
  const nsaidCheck = guard.evaluateSafety(['ibuprofen 800mg'], ulcerProfile);
  assert.equal(nsaidCheck.safeToPrescribe, false);
  assert.equal(nsaidCheck.alerts[0].type, 'CONDITION_CONTRAINDICATION');

  // Test 3: Safe prescription
  const safeProfile = {
    allergies: [],
    existingConditions: [],
    currentMedications: []
  };
  const safeCheck = guard.evaluateSafety(['acetaminophen 500mg'], safeProfile);
  assert.equal(safeCheck.safeToPrescribe, true);
  assert.equal(safeCheck.alertsCount, 0);
});

test('PulseMD Ambient Scribe: extracts structured observations from doctor-patient audio stream', () => {
  const scribe = new AmbientMedicalScribe();
  const dialogue = [
    { speaker: 'DOCTOR', text: 'Good morning, what brings you into the clinic today?' },
    { speaker: 'PATIENT', text: 'Doctor, I have been having severe chest pain and pressure for the past 3 days.' },
    { speaker: 'DOCTOR', text: 'Understood, let us order an immediate ECG and cardiac enzymes.' }
  ];

  const result = scribe.processDialogueStream(dialogue);
  assert.ok(result.extractedObservations.symptoms.includes('Chest Pressure/Pain'));
  assert.equal(result.extractedObservations.clinicalDuration, 'Acute (3-4 days)');
  assert.equal(result.fhirResourceDraft.resourceType, 'ClinicalImpression');
});
