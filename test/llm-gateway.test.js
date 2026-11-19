import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentOSLLMGateway } from '../src/llm-gateway.js';

test('AgentOSLLMGateway Test Suite', async (t) => {
  await t.test('initializes cleanly in offline/deterministic mode', () => {
    const gateway = new AgentOSLLMGateway();
    assert.equal(gateway.isConfigured, false);
    assert.equal(gateway.model, 'gemini-2.5-flash');
  });

  await t.test('generates valid FDCPA-compliant dunning notices and verifies action', async () => {
    const gateway = new AgentOSLLMGateway();
    const result = await gateway.generateDunningNotice({
      invoiceId: 'INV-8890',
      customerName: 'Acme Logistics',
      amountCents: 45000,
      daysPastDue: 21,
      tone: 'friendly',
      discountPercent: 10
    });

    assert.equal(result.success, true);
    assert.equal(result.amountCents, 40500); // 10% off $450
    assert.ok(result.text.includes('Acme Logistics'));
    assert.equal(result.guarded, true);
    assert.equal(result.audit.verified, true);
    assert.equal(result.audit.policyAlignmentScore, 100);
  });

  await t.test('calls custom mock Gemini fetcher and verifies response', async () => {
    const mockFetch = async (url, opts) => {
      assert.ok(url.includes('gemini-2.5-flash'));
      assert.equal(opts.method, 'POST');
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'Dear Alpha Corp, we kindly invite you to settle invoice INV-100 with zero interest.' }]
            }
          }]
        })
      };
    };

    const gateway = new AgentOSLLMGateway({
      apiKey: 'test-gemini-key',
      fetch: mockFetch
    });

    assert.equal(gateway.isConfigured, true);

    const result = await gateway.generateDunningNotice({
      invoiceId: 'INV-100',
      customerName: 'Alpha Corp',
      amountCents: 15000,
      daysPastDue: 14,
      tone: 'friendly'
    });

    assert.equal(result.success, true);
    assert.equal(result.provider, 'gemini (gemini-2.5-flash)');
    assert.ok(result.text.includes('Dear Alpha Corp'));
    assert.equal(result.audit.verified, true);
  });

  await t.test('speculative verifier intercepts and rejects coercive LLM response', async () => {
    const mockMaliciousFetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: 'Pay immediately or the police will arrest you and seize your property.' }]
          }
        }]
      })
    });

    const gateway = new AgentOSLLMGateway({
      apiKey: 'test-gemini-key',
      fetch: mockMaliciousFetch
    });

    const result = await gateway.generateDunningNotice({
      invoiceId: 'INV-MALICIOUS',
      customerName: 'Victim Corp',
      amountCents: 50000,
      daysPastDue: 90
    });

    assert.equal(result.success, false);
    assert.equal(result.audit.verified, false);
    assert.ok(result.audit.issues.some(issue => issue.includes('Coercive/prohibited debt collection phrase')));
  });

  await t.test('generates clinical SOAP note with clinician signoff requirement', async () => {
    const gateway = new AgentOSLLMGateway();
    const result = await gateway.generateClinicalSoap({
      encounterId: 'ENC-2026-09',
      clinicianName: 'Dr. Sarah Connor',
      patientName: 'John Doe',
      dialogueTurns: [
        { speaker: 'DOCTOR', text: 'What brings you in today?' },
        { speaker: 'PATIENT', text: 'I have had persistent left knee pain for 4 days after running.' }
      ]
    });

    assert.equal(result.encounterId, 'ENC-2026-09');
    assert.equal(result.status, 'AWAITING_CLINICIAN_DUAL_CONTROL_SIGNATURE');
    assert.ok(result.soap.subjective.includes('knee pain'));
    assert.ok(result.soap.plan.length > 0);
  });

  await t.test('generates dispute resolutions with threshold-based human escalation', async () => {
    const gateway = new AgentOSLLMGateway();

    // 1. Under $100 -> Autonomous Refund
    const autoResult = await gateway.generateDisputeResolution({
      disputeId: 'DISP-01',
      customerText: 'Screen arrived cracked',
      purchaseAmountCents: 4500, // $45.00
      warrantyDaysRemaining: 180
    });
    assert.equal(autoResult.resolutionType, 'FULL_REFUND_AUTONOMOUS');
    assert.equal(autoResult.requiresHumanSignoff, false);
    assert.equal(autoResult.refundCents, 4500);

    // 2. Over $100 -> Escalates to Supervisor
    const highValueResult = await gateway.generateDisputeResolution({
      disputeId: 'DISP-02',
      customerText: 'High end drone motor defect',
      purchaseAmountCents: 45000, // $450.00
      warrantyDaysRemaining: 60
    });
    assert.equal(highValueResult.resolutionType, 'ESCALATE_TO_SUPERVISOR_FOR_HIGH_VALUE');
    assert.equal(highValueResult.requiresHumanSignoff, true);
  });
});
