/**
 * PulseMD Ambient Medical Scribe: Ingests continuous multi-speaker encounter dialogues,
 * synthesizes structured clinical observations, and maps them into FHIR-ready records.
 */

export class AmbientMedicalScribe {
  processDialogueStream(dialogueTurns = []) {
    // dialogueTurns: [{ speaker: 'DOCTOR'|'PATIENT', text: '...', timestamp: '...' }]
    const patientStatements = dialogueTurns.filter(t => t.speaker === 'PATIENT').map(t => t.text).join(' ');
    const doctorStatements = dialogueTurns.filter(t => t.speaker === 'DOCTOR').map(t => t.text).join(' ');

    const lowerPatient = patientStatements.toLowerCase();

    // Extract symptoms
    const detectedSymptoms = [];
    if (lowerPatient.includes('chest pain') || lowerPatient.includes('pressure')) detectedSymptoms.push('Chest Pressure/Pain');
    if (lowerPatient.includes('shortness of breath') || lowerPatient.includes('breathing')) detectedSymptoms.push('Dyspnea on exertion');
    if (lowerPatient.includes('knee') || lowerPatient.includes('joint')) detectedSymptoms.push('Joint Arthralgia');
    if (lowerPatient.includes('headache') || lowerPatient.includes('migraine')) detectedSymptoms.push('Cephalea/Migraine');

    // Extract duration
    let duration = 'Undetermined duration';
    if (lowerPatient.includes('3 days') || lowerPatient.includes('few days')) duration = 'Acute (3-4 days)';
    if (lowerPatient.includes('weeks') || lowerPatient.includes('month')) duration = 'Subacute / Chronic';

    return {
      transcriptLength: dialogueTurns.length,
      extractedObservations: {
        symptoms: detectedSymptoms,
        clinicalDuration: duration,
        patientSubjectiveSummary: patientStatements.slice(0, 300),
        clinicianDirectives: doctorStatements.slice(0, 300)
      },
      fhirResourceDraft: {
        resourceType: 'ClinicalImpression',
        status: 'draft',
        investigation: [
          {
            code: { text: 'Clinical Encounter Symptom Stream' },
            item: detectedSymptoms.map(sym => ({ display: sym }))
          }
        ]
      }
    };
  }
}
