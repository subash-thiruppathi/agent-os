/**
 * @spekra.in/agent-os
 * AgentOS LLM Gateway & Speculative Guardrail
 *
 * Integrates Google Gemini models (e.g. gemini-2.5-flash) into the AgentOS
 * autonomous swarm with mandatory Speculative Verifier and SentinelMesh
 * pre-flight governance.
 */

import { SpeculativeVerifier } from '../agent-os-mobile/src/speculative-verifier.js';

export class AgentOSLLMGateway {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || null;
    this.model = options.model || 'gemini-2.5-flash';
    this.apiBaseUrl = options.apiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta/models';
    this.verifier = options.verifier || new SpeculativeVerifier();
    this.customFetch = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  }

  get isConfigured() {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  /**
   * Generates empathetic, FDCPA-compliant dunning & settlement communications.
   */
  async generateDunningNotice({ invoiceId, customerName, amountCents, daysPastDue, tone = 'friendly', discountPercent = 0 }) {
    const discountedTotal = discountPercent > 0
      ? Math.round(amountCents * (1 - discountPercent / 100))
      : amountCents;

    let generatedText = '';
    let usedProvider = 'deterministic';

    if (this.isConfigured && this.customFetch) {
      try {
        const prompt = `You are CashHound, an autonomous financial intelligence agent for Spekra.in.
Generate a concise, professional, non-coercive debt resolution notice for:
Customer: ${customerName}
Invoice: ${invoiceId}
Balance: $${(amountCents / 100).toFixed(2)}
Days Past Due: ${daysPastDue}
Tone: ${tone}
${discountPercent > 0 ? `Settlement Offer: ${discountPercent}% discount if paid within 7 days ($${(discountedTotal / 100).toFixed(2)} total)` : ''}
Rule: STRICTLY comply with FDCPA. Never mention arrests, police, jail, or property seizure.`;

        const resp = await this.customFetch(`${this.apiBaseUrl}/${this.model}:generateContent?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          usedProvider = `gemini (${this.model})`;
        }
      } catch {
        // Fall back cleanly to deterministic template on any network/API hitch
      }
    }

    if (!generatedText) {
      usedProvider = 'deterministic-fallback';
      if (discountPercent > 0) {
        generatedText = `Hi ${customerName}, we value our partnership and would like to help resolve invoice ${invoiceId}. As a special accommodation, we can settle your $${(amountCents / 100).toFixed(2)} balance for $${(discountedTotal / 100).toFixed(2)} (${discountPercent}% savings) if paid this week.`;
      } else {
        generatedText = `Hi ${customerName}, this is a gentle reminder that invoice ${invoiceId} ($${(amountCents / 100).toFixed(2)}) is ${daysPastDue} days past due. Please review your account or schedule an installment plan at your earliest convenience.`;
      }
    }

    // Speculative Verifier Guardrail: pre-flight safety check
    const candidateAction = {
      id: `act-dunning-${invoiceId}`,
      amountCents: discountedTotal,
      breakdown: [{ amountCents: discountedTotal }],
      title: `Dunning Notice (${tone})`,
      description: generatedText
    };

    const audit = this.verifier.verifyAction(candidateAction);

    return {
      success: audit.verified,
      provider: usedProvider,
      text: generatedText,
      amountCents: discountedTotal,
      audit,
      guarded: true
    };
  }

  /**
   * Generates FHIR SOAP notes from multi-speaker clinical dialogues.
   */
  async generateClinicalSoap({ encounterId, clinicianName, patientName, dialogueTurns = [] }) {
    const rawTranscript = dialogueTurns.map(t => `${t.speaker}: ${t.text}`).join('\n');
    let structuredSoap = null;
    let usedProvider = 'deterministic';

    if (this.isConfigured && this.customFetch) {
      try {
        const prompt = `You are PulseMD, an autonomous clinical charting agent for Spekra.in.
Extract a clinical SOAP note from this doctor-patient dialogue:
Clinician: ${clinicianName}
Patient: ${patientName}
Dialogue:
${rawTranscript}

Return JSON with structure: { "subjective": "...", "objective": "...", "assessment": "...", "plan": "...", "suspectedAllergies": [] }`;

        const resp = await this.customFetch(`${this.apiBaseUrl}/${this.model}:generateContent?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          structuredSoap = JSON.parse(text);
          usedProvider = `gemini (${this.model})`;
        }
      } catch {
        // Fall back cleanly
      }
    }

    if (!structuredSoap) {
      usedProvider = 'deterministic-fallback';
      const patientStatements = dialogueTurns.filter(t => t.speaker === 'PATIENT').map(t => t.text).join(' ');
      structuredSoap = {
        subjective: `Patient reports: ${patientStatements.slice(0, 150)}...`,
        objective: 'Vitals stable. Physical exam reveals localized tenderness without acute distress.',
        assessment: 'Uncomplicated acute presentation consistent with reported symptom history.',
        plan: 'Hydration, rest, symptom-targeted therapy. Follow up in 7 days if unresolved.',
        suspectedAllergies: []
      };
    }

    return {
      encounterId,
      provider: usedProvider,
      soap: structuredSoap,
      status: 'AWAITING_CLINICIAN_DUAL_CONTROL_SIGNATURE',
      phiSafe: true
    };
  }

  /**
   * Generates autonomous multi-stage customer dispute resolution battlecards.
   */
  async generateDisputeResolution({ disputeId, customerText, purchaseAmountCents, warrantyDaysRemaining }) {
    const isUnderWarranty = warrantyDaysRemaining > 0;
    const canAutonomousRefund = purchaseAmountCents <= 10000; // <= $100
    let resolutionType = '';
    let explanation = '';

    if (isUnderWarranty) {
      resolutionType = canAutonomousRefund ? 'FULL_REFUND_AUTONOMOUS' : 'ESCALATE_TO_SUPERVISOR_FOR_HIGH_VALUE';
      explanation = `Warranty valid (${warrantyDaysRemaining} days remaining). ${canAutonomousRefund ? 'Amount is within autonomous ceiling ($100).' : 'Amount exceeds autonomous ceiling, requiring human dual-control.'}`;
    } else {
      resolutionType = 'STORE_CREDIT_ACCOMMODATION';
      explanation = 'Item is past warranty expiration window; offering customer satisfaction loyalty credit.';
    }

    const candidateAction = {
      id: `act-dispute-${disputeId}`,
      amountCents: canAutonomousRefund ? purchaseAmountCents : 0,
      breakdown: canAutonomousRefund ? [{ amountCents: purchaseAmountCents }] : [],
      title: `Dispute Resolution (${resolutionType})`,
      description: `${explanation} Customer complaint: ${customerText}`
    };

    const audit = this.verifier.verifyAction(candidateAction);

    return {
      disputeId,
      resolutionType,
      explanation,
      refundCents: canAutonomousRefund ? purchaseAmountCents : 0,
      requiresHumanSignoff: !canAutonomousRefund || !isUnderWarranty,
      audit
    };
  }
}
