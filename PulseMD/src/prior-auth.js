/**
 * PulseMD Prior Authorization Builder: Compiles criteria checklist and clinical justifications.
 */

export const PAYER_GUIDELINES = {
  'mri_lumbar': {
    name: 'Lumbar Spine MRI',
    prerequisites: ['physical_therapy_completed', 'conservative_management_6_weeks', 'radiograph_completed'],
    cptCode: '72148'
  },
  'glp1_semaglutide': {
    name: 'GLP-1 Receptor Agonist',
    prerequisites: ['documented_hba1c_elevated', 'metformin_trial_failed'],
    cptCode: 'J3490'
  }
};

export class PriorAuthEngine {
  buildAuthPacket(patientId, procedureKey, patientHistory = {}) {
    const guideline = PAYER_GUIDELINES[procedureKey];
    if (!guideline) {
      throw new Error(`Procedure ${procedureKey} is not registered in guidelines.`);
    }

    const missingPrerequisites = guideline.prerequisites.filter(req => !patientHistory[req]);
    const isCompliant = missingPrerequisites.length === 0;

    return {
      authPacketId: `pa_${Date.now()}`,
      patientId,
      procedureName: guideline.name,
      cptCode: guideline.cptCode,
      isCompliant,
      missingPrerequisites,
      status: isCompliant ? 'READY_FOR_CLINICIAN_REVIEW' : 'DEFICIENT_CRITERIA',
      timestamp: new Date().toISOString()
    };
  }
}
