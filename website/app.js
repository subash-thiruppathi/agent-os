/**
 * AgentOS Interactive Website Controller, Gamification Engine & Cyber Defense Simulator
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // 1. Web Audio Synthesizer (Zero-Dependency Cyberpunk SFX)
  // =========================================================================
  let audioEnabled = localStorage.getItem('agentos_sfx') !== 'false';
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSfx(type) {
    if (!audioEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.05);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'action') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'shield') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.06); // A5
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'alarm') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(196, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'levelup') {
        // Triumphant 4-note arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const noteOsc = audioCtx.createOscillator();
          const noteGain = audioCtx.createGain();
          noteOsc.connect(noteGain);
          noteGain.connect(audioCtx.destination);
          noteOsc.type = 'sine';
          noteOsc.frequency.setValueAtTime(freq, now + idx * 0.08);
          noteGain.gain.setValueAtTime(0.14, now + idx * 0.08);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.15);
          noteOsc.start(now + idx * 0.08);
          noteOsc.stop(now + idx * 0.08 + 0.15);
        });
      }
    } catch {
      // Audio not permitted without prior user gesture
    }
  }

  // Audio Toggle UI
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  const audioIcon = document.getElementById('audioIcon');
  const audioLabel = document.getElementById('audioLabel');

  function updateAudioButton() {
    if (!audioToggleBtn) return;
    if (audioEnabled) {
      audioToggleBtn.classList.add('active');
      if (audioIcon) audioIcon.textContent = '🔊';
      if (audioLabel) audioLabel.textContent = 'SFX ON';
    } else {
      audioToggleBtn.classList.remove('active');
      if (audioIcon) audioIcon.textContent = '🔇';
      if (audioLabel) audioLabel.textContent = 'SFX OFF';
    }
  }

  if (audioToggleBtn) {
    updateAudioButton();
    audioToggleBtn.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      localStorage.setItem('agentos_sfx', audioEnabled);
      updateAudioButton();
      if (audioEnabled) playSfx('click');
    });
  }

  // =========================================================================
  // 2. Operator XP & Gamification Engine
  // =========================================================================
  let operatorXp = parseInt(localStorage.getItem('agentos_xp') || '50', 10);
  let unlockedBadges = JSON.parse(localStorage.getItem('agentos_badges') || '[]');

  const hudRankIcon = document.getElementById('hudRankIcon');
  const hudRankTitle = document.getElementById('hudRankTitle');
  const hudBadgeProgress = document.getElementById('hudBadgeProgress');
  const hudXpText = document.getElementById('hudXpText');
  const hudXpBar = document.getElementById('hudXpBar');

  const RANKS = [
    { level: 1, minXp: 0, title: 'Cadet Operator', icon: '⚡' },
    { level: 2, minXp: 200, title: 'Field Specialist', icon: '🛡️' },
    { level: 3, minXp: 450, title: 'Security Sentinel', icon: '🛰️' },
    { level: 4, minXp: 750, title: 'Swarm Commander', icon: '🐝' },
    { level: 5, minXp: 1000, title: 'Grand Fleet Admiral', icon: '👑' }
  ];

  function getRank(xp) {
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (xp >= RANKS[i].minXp) return RANKS[i];
    }
    return RANKS[0];
  }

  function updateGamificationUi() {
    const currentRank = getRank(operatorXp);
    const nextRank = RANKS.find(r => r.level === currentRank.level + 1) || { minXp: 1000 };

    if (hudRankIcon) hudRankIcon.textContent = currentRank.icon;
    if (hudRankTitle) hudRankTitle.textContent = `${currentRank.title} (Lvl ${currentRank.level})`;
    if (hudBadgeProgress) hudBadgeProgress.textContent = `${unlockedBadges.length} / 7 Trophies Unlocked`;
    if (hudXpText) hudXpText.textContent = `${operatorXp} / ${nextRank.minXp} XP`;

    if (hudXpBar) {
      const pct = Math.min(100, Math.max(5, (operatorXp / 1000) * 100));
      hudXpBar.style.width = pct + '%';
    }

    // Refresh trophy cards locked/unlocked state
    unlockedBadges.forEach(badgeId => {
      const card = document.getElementById(`badge-${badgeId}`);
      if (card) {
        card.classList.remove('locked');
        card.classList.add('unlocked');
      }
    });
  }

  function awardXp(amount, badgeId = null, badgeName = '') {
    const prevRank = getRank(operatorXp);
    operatorXp = Math.min(1000, operatorXp + amount);
    localStorage.setItem('agentos_xp', operatorXp);

    let newlyUnlocked = false;
    if (badgeId && !unlockedBadges.includes(badgeId)) {
      unlockedBadges.push(badgeId);
      localStorage.setItem('agentos_badges', JSON.stringify(unlockedBadges));
      newlyUnlocked = true;
    }

    updateGamificationUi();

    const newRank = getRank(operatorXp);
    if (newRank.level > prevRank.level) {
      playSfx('levelup');
      showLevelUpToast(`PROMOTED TO ${newRank.title.toUpperCase()}!`, `You reached Level ${newRank.level} with ${operatorXp} XP!`);
      triggerConfetti();
    } else if (newlyUnlocked) {
      playSfx('levelup');
      showLevelUpToast(`🏆 TROPHY UNLOCKED: ${badgeName}!`, `+${amount} XP Awarded to your Operator Profile.`);
      if (unlockedBadges.length === 7) {
        triggerConfetti();
      }
    }
  }

  function showLevelUpToast(title, msg) {
    const existing = document.querySelector('.levelup-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'levelup-toast';
    toast.innerHTML = `
      <div class="levelup-icon">🏆</div>
      <div class="levelup-text">
        <h4>${title}</h4>
        <p>${msg}</p>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  updateGamificationUi();

  // =========================================================================
  // 3. Quickstart Copy Button
  // =========================================================================
  const copyBtn = document.getElementById('copyBtn');
  const codeBlock = document.getElementById('quickstartCode');
  if (copyBtn && codeBlock) {
    copyBtn.addEventListener('click', () => {
      playSfx('click');
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

  // =========================================================================
  // 4. Interactive Simulator Tab Switching
  // =========================================================================
  const tabBtns = document.querySelectorAll('.sim-tab-btn');
  const simPanels = document.querySelectorAll('.sim-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      playSfx('click');
      const targetId = btn.getAttribute('data-target');
      tabBtns.forEach(b => b.classList.remove('active'));
      simPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // =========================================================================
  // 5. Live Simulator Agent Handlers with XP Rewards
  // =========================================================================
  window.runAgentSim = async function(agentType) {
    playSfx('action');
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

    // Pre-execution Verifier
    await sleep(250);
    if (consoleOutput) {
      consoleOutput.innerHTML += `<br><span class="log-line log-verifier">[SpeculativeVerifier] Running minor-unit math audit & FDCPA tone safety check...</span>`;
    }

    // Privacy / Memory Graph Check
    await sleep(300);
    if (consoleOutput) {
      consoleOutput.innerHTML += `<br><span class="log-line log-memory">[MemoryGraph] Partition verified. Caller permissions validated.</span>`;
    }

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
        awardXp(100, 'cashhound', 'Cash Hunter');
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
        awardXp(100, 'resolvex', 'Dispute Slayer');
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
        awardXp(100, 'sentinelmesh', 'Zero-Trust Guard');
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
        awardXp(100, 'localroar', 'Density Master');
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
        awardXp(100, 'pulsemd', 'HIPAA Sentinel');
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
        awardXp(100, 'omnilife', 'Sovereign OS');
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
        awardXp(250, 'swarm', 'Swarm General');
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

  // =========================================================================
  // 6. Adversarial Attack Defense Simulator
  // =========================================================================
  window.triggerCyberAttack = async function(attackType) {
    playSfx('alarm');
    const radar = document.getElementById('defenseRadarConsole');
    const status = document.getElementById('shieldRadarStatus');

    if (status) {
      status.textContent = '⚡ DEFLECTING THREAT...';
      status.style.color = '#ef4444';
    }

    if (radar) {
      radar.innerHTML = `<span class="log-line log-threat">[INTRUSION ALERT] Firing attack vector: ${attackType.toUpperCase()}</span>`;
    }

    await sleep(350);

    let threatDetail = '';
    let defenseDetail = '';
    let xpGain = 120;

    switch (attackType) {
      case 'coercion':
        threatDetail = 'Injecting coercive string: "Threaten immediate police arrest if not paid in 1 hour"';
        defenseDetail = '[SpeculativeVerifier] Threat INTERCEPTED. Pattern /police|arrest/ detected. Action quarantined with 0 score.';
        break;
      case 'phi':
        threatDetail = 'Commercial marketing bot attempting to read unrestricted query: SELECT patient_ssn, medical_diagnosis';
        defenseDetail = '[AgentMemoryGraph] Cryptographic privacy boundary violated. RESTRICTED_PHI tier denied to caller "localroar". Leak prevented.';
        break;
      case 'outage':
        threatDetail = 'Stripe API returning HTTP 429 Too Many Requests under 20,000 req/sec flood';
        defenseDetail = '[AgentSelfHealer] Fault classified as RATE_LIMIT_429. Executed exponential backoff and failed over to Adyen secondary rail. Zero dropped tasks.';
        break;
      case 'fraud':
        threatDetail = 'Claimant submitted downloaded cracked screen stock photo with fake EXIF timestamp';
        defenseDetail = '[ResolveX DamageVerifier] Computer vision image clarity & reverse metadata scan flagged stock photo watermark. Auto-refund DENIED. Escalated to fraud desk.';
        break;
    }

    if (radar) {
      radar.innerHTML += `<br><span class="log-line" style="color: #fca5a5;">> ${threatDetail}</span>`;
      radar.scrollTop = radar.scrollHeight;
    }

    await sleep(400);
    playSfx('shield');

    if (radar) {
      radar.innerHTML += `<br><span class="log-line log-shield">> ${defenseDetail}</span>`;
      radar.innerHTML += `<br><span class="log-line log-success">✓ THREAT NEUTRALIZED. Runtime state remains 100% untampered. (+${xpGain} XP)</span>`;
      radar.scrollTop = radar.scrollHeight;
    }

    if (status) {
      status.textContent = '● SHIELD SECURE (DEFLECTED)';
      status.style.color = '#10b981';
    }

    awardXp(xpGain, null, 'Cyber Defense Operator');
  };

  // =========================================================================
  // 7. Interactive ROI Calculator
  // =========================================================================
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

    const invoiceSavings = invoices * 2500 * 0.15;
    const disputeSavings = disputes * 35 * 12;
    const subSavings = subs * 0.20 * 12;

    const totalAnnual = Math.round(invoiceSavings + disputeSavings + subSavings);
    const hours = Math.round((disputes * 0.4 * 12) + (invoices * 0.75 * 12));

    if (totalRoi) totalRoi.textContent = '$' + totalAnnual.toLocaleString();
    if (hoursReclaimed) hoursReclaimed.textContent = hours.toLocaleString() + ' hrs';
  }

  if (invSlider && dispSlider && subSlider) {
    invSlider.addEventListener('input', () => { updateCalculator(); playSfx('click'); });
    dispSlider.addEventListener('input', () => { updateCalculator(); playSfx('click'); });
    subSlider.addEventListener('input', () => { updateCalculator(); playSfx('click'); });
    updateCalculator();
  }

  // =========================================================================
  // 7.5 Live Server-Sent Events (SSE) Telemetry Stream
  // =========================================================================
  const liveSseConsole = document.getElementById('liveSseConsole');
  const sseStreamStatus = document.getElementById('sseStreamStatus');

  if (window.EventSource && liveSseConsole) {
    try {
      const evtSource = new EventSource('/api/fleet/stream');

      evtSource.onopen = () => {
        if (sseStreamStatus) {
          sseStreamStatus.textContent = '● SSE CONNECTED (LIVE)';
          sseStreamStatus.style.color = '#10B981';
        }
      };

      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const time = new Date().toLocaleTimeString();
          let lineHtml = '';

          if (data.type === 'CONNECTED') {
            lineHtml = `<span style="color: #38bdf8;">[${time}] ${data.message}</span>`;
          } else if (data.type === 'SPAN_STARTED') {
            lineHtml = `<span style="color: #818cf8;">[${time}] SPAN_STARTED &rarr; name=${data.span.name} agent=${data.span.agentName} (traceId: ${data.span.traceId.slice(0, 10)}...)</span>`;
          } else if (data.type === 'SPAN_COMPLETED') {
            lineHtml = `<span style="color: #10b981;">[${time}] SPAN_COMPLETED &check; name=${data.span.name} duration=${data.span.durationMs}ms status=${data.span.status}</span>`;
          } else if (data.type === 'INCIDENT_ALERT') {
            lineHtml = `<span style="color: #ef4444; font-weight: 700;">[${time}] 🚨 INCIDENT_ALERT &rarr; ${data.alert.alertId} (${data.alert.faultSignature}): ${data.alert.message}</span>`;
          } else if (data.type === 'LEDGER_MIRRORED') {
            lineHtml = `<span style="color: #f59e0b;">[${time}] 📜 LEDGER_MIRRORED &rarr; Block #${data.record.blockIndex} SHA-256=${data.record.hash.slice(0, 12)}... SpekraProofVerified</span>`;
          }

          if (lineHtml) {
            liveSseConsole.innerHTML += `<br>${lineHtml}`;
            liveSseConsole.scrollTop = liveSseConsole.scrollHeight;
          }
        } catch {
          // non-JSON message
        }
      };

      evtSource.onerror = () => {
        if (sseStreamStatus) {
          sseStreamStatus.textContent = '○ DISCONNECTED (RECONNECTING...)';
          sseStreamStatus.style.color = '#94A3B8';
        }
      };
    } catch {
      // EventSource failed or static hosting mode
    }
  }

  // =========================================================================
  // 8. FAQ Accordion
  // =========================================================================
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        playSfx('click');
        const isOpen = item.classList.contains('active');
        faqItems.forEach(i => i.classList.remove('active'));
        if (!isOpen) item.classList.add('active');
      });
    }
  });

  // =========================================================================
  // 9. Neural Particle Constellation Background Canvas
  // =========================================================================
  const canvas = document.getElementById('neural-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = [];
    const count = Math.min(50, Math.floor(width / 30));

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 2 + 1.2
      });
    }

    function renderParticles() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.7)';
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.35 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(renderParticles);
    }

    renderParticles();
  }

  // =========================================================================
  // 10. High-Performance Particle Confetti Celebration
  // =========================================================================
  function triggerConfetti() {
    const cCanvas = document.getElementById('confetti-canvas');
    if (!cCanvas) return;
    const cCtx = cCanvas.getContext('2d');
    cCanvas.width = window.innerWidth;
    cCanvas.height = window.innerHeight;

    const confettiPieces = [];
    const colors = ['#6366F1', '#38BDF8', '#10B981', '#F59E0B', '#EC4899', '#A855F7'];

    for (let i = 0; i < 90; i++) {
      confettiPieces.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 18,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 12,
        alpha: 1.0
      });
    }

    let frame = 0;
    function renderConfetti() {
      cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
      let alive = false;

      for (const p of confettiPieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.rotation += p.vr;
        p.alpha -= 0.012;

        if (p.alpha > 0) {
          alive = true;
          cCtx.save();
          cCtx.translate(p.x, p.y);
          cCtx.rotate((p.rotation * Math.PI) / 180);
          cCtx.fillStyle = p.color;
          cCtx.globalAlpha = p.alpha;
          cCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          cCtx.restore();
        }
      }

      frame++;
      if (alive && frame < 120) {
        requestAnimationFrame(renderConfetti);
      } else {
        cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
      }
    }

    renderConfetti();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
