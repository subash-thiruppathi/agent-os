# PulseMD — Autonomous Clinical Operations & Prior-Authorization Agent

**PulseMD** reduces clinician administrative burden by converting raw clinical encounters into structured SOAP chart notes, automating prior-authorization verification against payer criteria, and strictly enforcing licensed clinician sign-off gates.

## Capabilities

1. **Autonomous SOAP Charting:** Generates structured Subjective, Objective, Assessment, and Plan drafts directly from patient encounters.
2. **Prior-Authorization Verification Engine:** Cross-checks patient treatment records against payer prerequisite rules (CPT codes, physical therapy trials, radiographic evidence) before submission.
3. **Mandatory Clinician Approval Gate:** Enforces human-in-the-loop sign-off on all clinical documentation and insurer filings to guarantee patient safety and regulatory compliance.
4. **Audit & Traceability:** Retains complete cryptographic logs of revisions and physician signatures.

## Usage

```javascript
import { PulseMDAgent } from 'pulsemd-agent';

const agent = new PulseMDAgent();

// 1. Process encounter notes into draft SOAP record
const draft = agent.processEncounter({
  patientId: 'pt-1001',
  chiefComplaint: 'Right knee pain after sports injury',
  vitals: { bp: '124/82', hr: '76' },
  conversation: 'Twisted knee during soccer match.'
});

// 2. Clinician reviews and signs
const lockedNote = agent.signAndFinalizeNote(draft.draftNote.draftId, 'dr-smith-md');

// 3. Evaluate prior-auth criteria for MRI
const paResult = agent.evaluatePriorAuth('pt-1001', 'mri_lumbar', {
  physical_therapy_completed: true,
  conservative_management_6_weeks: true,
  radiograph_completed: true
});
```

## Testing

```sh
npm test
```
