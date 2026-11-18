import { ChartingEngine } from './charting.js';
import { PriorAuthEngine } from './prior-auth.js';
import { ClinicianAuth } from './auth.js';

/**
 * PulseMD Agent: Orchestrates clinical documentation & authorizations with strict clinician sign-off gates.
 */
export class PulseMDAgent {
  constructor(authSecret = ClinicianAuth.DEFAULT_SECRET) {
    this.charting = new ChartingEngine();
    this.priorAuth = new PriorAuthEngine();
    this.authSecret = authSecret;
    this.signedRecords = [];
  }

  processEncounter(encounter) {
    const draftNote = this.charting.draftSoapNote(encounter);
    return {
      status: 'AWAITING_CLINICIAN_SIGNATURE',
      draftNote,
      guidance: 'All clinical assessments and orders must be verified and signed by a licensed practitioner.'
    };
  }

  /**
   * Enforces SEC-02: Cryptographic clinician token verification to prevent impersonation.
   */
  signAndFinalizeNote(draftNoteId, clinicianId, modifications = {}, signatureToken = null) {
    if (!clinicianId) throw new Error('Clinician ID required to sign medical documentation.');

    const verification = ClinicianAuth.verifyToken(signatureToken, clinicianId, this.authSecret);
    if (!verification.valid) {
      throw new Error(`Unauthorized signature attempt: ${verification.error}`);
    }

    const finalized = {
      recordId: draftNoteId,
      clinicianId,
      verifiedRole: verification.role,
      signedAt: new Date().toISOString(),
      status: 'FINALIZED_AND_LOCKED',
      signatureToken: signatureToken.slice(0, 16) + '...',
      modifications
    };

    this.signedRecords.push(finalized);
    return finalized;
  }

  evaluatePriorAuth(patientId, procedureKey, patientHistory) {
    const packet = this.priorAuth.buildAuthPacket(patientId, procedureKey, patientHistory);

    if (!packet.isCompliant) {
      return {
        action: 'FLAG_DEFICIENCY',
        missing: packet.missingPrerequisites,
        message: `Payer prior-auth criteria not met: missing ${packet.missingPrerequisites.join(', ')}`
      };
    }

    return {
      action: 'SUBMIT_FOR_CLINICIAN_APPROVAL',
      packet,
      message: 'Prior authorization criteria verified. Awaiting clinician signature to submit to payer portal.'
    };
  }
}
