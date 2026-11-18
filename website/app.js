/**
 * AgentOS Interactive Website Controller & Simulator Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Copy Quickstart Command
  const copyBtn = document.getElementById('copyBtn');
  const codeBlock = document.getElementById('quickstartCode');
  if (copyBtn && codeBlock) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(codeBlock.innerText.trim()).then(() => {
        const orig = copyBtn.innerHTML;
        copyBtn.innerHTML = '✓ Copied!';
        copyBtn.style.background = '#10B981';
        setTimeout(() => {
          copyBtn.innerHTML = orig;
          copyBtn.style.background = '';
        }, 2000);
      });
    });
  }

  // 2. Interactive Simulator Tab Switching
  const tabBtns = document.querySelectorAll('.sim-tab-btn');
  const simPanels = document.querySelectorAll('.sim-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      tabBtns.forEach(b => b.classList.remove('active'));
      simPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // 3. Live Simulator Agent Handlers
  window.runAgentSim = async function(agentType) {
    const consoleOutput = document.getElementById(`sim-console-${agentType}`);
    const statusPill = document.getElementById(`sim-status-${agentType}`);
    const resultBox = document.getElementById(`sim-result-${agentType}`);

    if (statusPill) {
      statusPill.textContent = 'EXECUTING...';
      statusPill.className = 'status-pill pill-working';
    }

    if (consoleOutput) {
      consoleOutput.innerHTML = `<span class="log-line log-info">[AgentOS Runtime] Initializing ${agentType} execution container...</span>`;
    }

    // Step 1: Pre-execution Verifier
    await sleep(250);
    if (consoleOutput) {
      consoleOutput.innerHTML += `<br><span class="log-line log-verifier">[SpeculativeVerifier] Running minor-unit math audit & FDCPA tone safety check...</span>`;
    }

    // Step 2: Privacy / Memory Graph Check
    await sleep(300);
    if (consoleOutput) {
      consoleOutput.innerHTML += `<br><span class="log-line log-memory">[MemoryGraph] Partition verified. Caller permissions validated.</span>`;
    }

    // Step 3: Agent Task
    await sleep(400);

    let resultData = null;
    let successMessage = '';

    switch(agentType) {
      case 'cashhound':
        resultData = {
          agent: 'CashHound',
          invoiceId: 'INV-1094',
          amount: '$8,400.00',
          daysPastDue: 38,
          recoveryProbability: '79.4%',
          npvExpectedReturn: '$7,250.00',
          decision: 'Lump-Sum Settlement Offer (10% Discount) with Dual Approval Gate',
          fdcpaCompliance: 'PASSED (0 coercive phrases detected)'
        };
        successMessage = 'Evaluated DCF recovery curve. Generated respectful dunning notice with 1-click settlement link.';
        break;

      case 'resolvex':
        resultData = {
          agent: 'ResolveX',
          ticketId: 'TCK-8819',
          issueType: 'DOUBLE_BILLING',
          claimedAmount: '$49.99',
          evidenceFound: 'Duplicate charge matched in Stripe within 1.2s window',
          actionTaken: 'INSTANT_AUTO_REFUND',
          idempotencyKey: 'sha256-d7a8f9c1b3e5... (Replay Protected)',
          apologyCredit: '$10.00 Loyalty Voucher Issued',
          customerNotification: 'SMS & Email dispatched automatically'
        };
        successMessage = 'Dispute auto-resolved in 380ms under $100 autonomous ceiling without human escalation.';
        break;

      case 'sentinelmesh':
        resultData = {
          governor: 'SentinelMesh',
          activeAgents: 7,
          tamperEvidentBlocks: 1493,
          latestBlockHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          leastPrivilegeEnforced: true,
          killswitchStatus: 'STANDBY (ARMED)',
          policyViolations: 0
        };
        successMessage = 'Cryptographic boundary verified. Block ledger frozen with SHA-256 state immutability.';
        break;

      case 'localroar':
        resultData = {
          agent: 'LocalRoar',
          leadChannel: 'Inbound SMS (+1 555-019-3829)',
          leadText: 'Emergency water leak in master bathroom, need immediate plumber!',
          matchedService: 'Emergency Plumbing Dispatch',
          technicianAssigned: 'Truck #4 (Currently on Maple Ave, 1.4 miles away)',
          routeDensityBonus: '15% Neighborhood Proximity Discount Applied',
          estimatedArrival: '18 minutes',
          instantQuote: '$185.00'
        };
        successMessage = 'Inbound lead converted. Proximity match triggered automatic 15% route-density discount.';
        break;

      case 'pulsemd':
        resultData = {
          agent: 'PulseMD',
          encounterId: 'ENC-2026-904',
          clinician: 'Dr. Sarah Smith, MD',
          dialogueParsed: 'Patient reports severe right knee pain after soccer tackle. No swelling yesterday, acute edema today.',
          phiMasking: {
            ssn: '[REDACTED: SSN]',
            phone: '[REDACTED: TEL]',
            dob: '[REDACTED: DATE]'
          },
          contraindicationGuard: 'PASSED (Zero NSAID allergies or drug conflicts detected)',
          soapNoteDrafted: true,
          status: 'PENDING_CLINICIAN_HMAC_SIGNATURE'
        };
        successMessage = 'Ambient dialogue scribed into FHIR SOAP note. All PHI masked before memory graph entry.';
        break;

      case 'omnilife':
        resultData = {
          agent: 'OmniLife',
          subscriptionsAudited: 14,
          dormantFound: 2,
          dormantService: 'Equinox Elite Gym ($180/mo, unused for 110 days)',
          earlyTerminationPenalty: '$50.00 penalty detected',
          action: 'HOLD FOR HUMAN BIOMETRIC APPROVAL (Penalty Protection Gate)',
          internationalTravelCheck: 'PASSED (Passport valid for 18 months, 6-month rule satisfied)'
        };
        successMessage = 'Dormant subscription flagged. Penalty gate activated to prevent unauthorized early fee.';
        break;

      case 'swarm':
        resultData = {
          pipeline: 'AgentOS End-to-End Swarm',
          stages: [
            { step: 1, agent: 'LocalRoar', action: 'Lead Ingestion & Quote', status: 'COMPLETED' },
            { step: 2, agent: 'Booker', action: 'Slot Locking & Calendar Sync', status: 'COMPLETED' },
            { step: 3, agent: 'Sidekick', action: 'Evidence & Work Checklist', status: 'COMPLETED' },
            { step: 4, agent: 'Clerk', action: 'Invoice & Payment Reconciliation', status: 'COMPLETED' },
            { step: 5, agent: 'SentinelMesh', action: 'Zero-Trust Audit Log Frozen', status: 'COMPLETED' }
          ],
          totalDurationMs: 42,
          governanceState: 'VERIFIED_AND_SIGNED'
        };
        successMessage = 'Swarm completed full 5-stage lifecycle autonomously under SentinelMesh governance.';
        break;
    }

    if (consoleOutput) {
      consoleOutput.innerHTML += `<br><span class="log-line log-success">[Execution Complete] ${successMessage}</span>`;
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    if (statusPill) {
      statusPill.textContent = 'COMPLETED (200 OK)';
      statusPill.className = 'status-pill pill-success';
    }

    if (resultBox) {
      resultBox.innerHTML = `<pre><code>${JSON.stringify(resultData, null, 2)}</code></pre>`;
    }
  };

  // 4. Interactive ROI Calculator
  const invSlider = document.getElementById('calc-invoices');
  const dispSlider = document.getElementById('calc-disputes');
  const subSlider = document.getElementById('calc-subs');

  const invVal = document.getElementById('calc-invoices-val');
  const dispVal = document.getElementById('calc-disputes-val');
  const subVal = document.getElementById('calc-subs-val');

  const totalRoi = document.getElementById('calc-total-savings');
  const hoursReclaimed = document.getElementById('calc-hours-reclaimed');

  function updateCalculator() {
    if (!invSlider || !dispSlider || !subSlider) return;

    const invoices = parseInt(invSlider.value, 10);
    const disputes = parseInt(dispSlider.value, 10);
    const subs = parseInt(subSlider.value, 10);

    if (invVal) invVal.textContent = invoices.toLocaleString();
    if (dispVal) dispVal.textContent = disputes.toLocaleString();
    if (subVal) subVal.textContent = '$' + subs.toLocaleString();

    // Economic model:
    // Avg uncollected invoice: $2,500 with 15% recovery improvement via CashHound
    // Dispute auto-resolution saving: $35 per ticket in human support agent time
    // Subscription cancellation saving: 20% of monthly corporate spend
    const invoiceSavings = invoices * 2500 * 0.15;
    const disputeSavings = disputes * 35 * 12;
    const subSavings = subs * 0.20 * 12;

    const totalAnnual = Math.round(invoiceSavings + disputeSavings + subSavings);
    const hours = Math.round((disputes * 0.4 * 12) + (invoices * 0.75 * 12));

    if (totalRoi) totalRoi.textContent = '$' + totalAnnual.toLocaleString();
    if (hoursReclaimed) hoursReclaimed.textContent = hours.toLocaleString() + ' hrs';
  }

  if (invSlider && dispSlider && subSlider) {
    invSlider.addEventListener('input', updateCalculator);
    dispSlider.addEventListener('input', updateCalculator);
    subSlider.addEventListener('input', updateCalculator);
    updateCalculator();
  }

  // 5. FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('active');
        faqItems.forEach(i => i.classList.remove('active'));
        if (!isOpen) item.classList.add('active');
      });
    }
  });

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
