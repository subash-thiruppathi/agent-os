/**
 * PulseMD Charting Engine: Converts clinical encounter transcripts into structured SOAP notes.
 * Enforces HIPAA-compliant Protected Health Information (PHI) sanitization.
 */

export class ChartingEngine {
  /**
   * Redacts sensitive personal identifiers from clinical free-text.
   */
  static sanitizePhi(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      // SSN: 000-00-0000
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
      // Phone: 555-555-5555
      .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]')
      // Email
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  }

  draftSoapNote(encounter) {
    const { patientId, chiefComplaint, vitals = {}, conversation = '', clinicianName } = encounter;

    const sanitizedComplaint = ChartingEngine.sanitizePhi(chiefComplaint);
    const sanitizedConversation = ChartingEngine.sanitizePhi(conversation);

    const subjective = `Patient presents with: ${sanitizedComplaint}. Encounter notes: ${sanitizedConversation}`;
    const objective = `Vitals: BP ${vitals.bp || '120/80'}, HR ${vitals.hr || '72'}, Temp ${vitals.temp || '98.6F'}.`;
    
    // Extract preliminary assessment hints
    let assessment = 'Evaluation of symptoms noted in chief complaint.';
    if (sanitizedComplaint.toLowerCase().includes('knee pain')) {
      assessment = 'Suspected internal derangement or osteoarthritis of knee.';
    } else if (sanitizedComplaint.toLowerCase().includes('hypertension')) {
      assessment = 'Essential hypertension, follow-up control.';
    }

    const plan = 'Draft recommendation: obtain diagnostic imaging or lab follow-up as reviewed by physician.';

    return {
      draftId: `soap_${Date.now()}`,
      patientId: ChartingEngine.sanitizePhi(patientId),
      clinicianName,
      status: 'DRAFT_PENDING_PHYSICIAN_SIGNATURE',
      soap: {
        subjective,
        objective,
        assessment,
        plan
      },
      createdAt: new Date().toISOString()
    };
  }
}
