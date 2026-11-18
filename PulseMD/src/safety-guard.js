/**
 * PulseMD Clinical Safety Guard: Evaluates drug-drug interactions, patient allergy alerts,
 * and contraindications against evidence-based pharmacological rules.
 */

export const CONTRAINDICATION_RULES = [
  {
    drugClass: 'nsaid',
    names: ['ibuprofen', 'naproxen', 'ketorolac', 'meloxicam'],
    conflictConditions: ['peptic_ulcer', 'chronic_kidney_disease', 'severe_renal_impairment'],
    severity: 'HIGH_RISK',
    warning: 'NSAIDs are contraindicated in patients with active peptic ulcer disease or severe renal impairment (risk of GI bleed / acute kidney injury).'
  },
  {
    drugClass: 'ace_inhibitor',
    names: ['lisinopril', 'enalapril', 'ramipril'],
    conflictDrugs: ['spironolactone', 'potassium_chloride'],
    severity: 'CRITICAL',
    warning: 'Concurrent ACE inhibitor and potassium-sparing agent carries high risk of life-threatening hyperkalemia.'
  }
];

export class ClinicalSafetyGuard {
  evaluateSafety(proposedMedications = [], patientProfile = {}) {
    const { allergies = [], existingConditions = [], currentMedications = [] } = patientProfile;
    const alerts = [];

    const lowerProposed = proposedMedications.map(m => m.toLowerCase());
    const lowerAllergies = allergies.map(a => a.toLowerCase());
    const lowerConditions = existingConditions.map(c => c.toLowerCase());
    const lowerCurrentMeds = currentMedications.map(m => m.toLowerCase());

    // 1. Allergy check
    for (const med of lowerProposed) {
      for (const allergy of lowerAllergies) {
        if (med.includes(allergy) || allergy.includes(med)) {
          alerts.push({
            type: 'ALLERGY_ALERT',
            severity: 'CRITICAL',
            medication: med,
            allergy,
            message: `FATAL ALLERGY WARNING: Proposed medication '${med}' matches patient documented allergy to '${allergy}'.`
          });
        }
      }
    }

    // 2. Condition & Drug Contraindications
    for (const rule of CONTRAINDICATION_RULES) {
      const matchesProposed = rule.names.some(name => lowerProposed.some(p => p.includes(name)));
      if (matchesProposed) {
        // Condition conflict
        if (rule.conflictConditions) {
          const conditionMatch = rule.conflictConditions.find(cond => lowerConditions.includes(cond));
          if (conditionMatch) {
            alerts.push({
              type: 'CONDITION_CONTRAINDICATION',
              severity: rule.severity,
              rule: rule.drugClass,
              condition: conditionMatch,
              message: rule.warning
            });
          }
        }

        // Current drug conflict
        if (rule.conflictDrugs) {
          const drugMatch = rule.conflictDrugs.find(cd => lowerCurrentMeds.some(m => m.includes(cd)));
          if (drugMatch) {
            alerts.push({
              type: 'DRUG_DRUG_INTERACTION',
              severity: rule.severity,
              rule: rule.drugClass,
              conflictingDrug: drugMatch,
              message: rule.warning
            });
          }
        }
      }
    }

    return {
      safeToPrescribe: alerts.length === 0,
      alertsCount: alerts.length,
      alerts
    };
  }
}
