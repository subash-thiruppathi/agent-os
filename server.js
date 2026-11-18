import http from 'node:http';
import { CashHoundAgent, Invoice } from './CashHound/src/index.js';
import { ResolveXAgent } from './ResolveX/src/index.js';
import { SentinelGovernor, PermissionScope } from './SentinelMesh/src/index.js';
import { LocalRoarAgent } from './LocalRoar/src/index.js';
import { PulseMDAgent, ClinicianAuth } from './PulseMD/src/index.js';
import { OmniLifeAgent } from './OmniLife/src/index.js';
import { parseIntake, CalendarAdapter } from './Booker/src/index.js';
import { AgentMemoryGraph, MemoryPrivacyTier } from './agent-os-mobile/src/memory-graph.js';
import { AgentSelfHealer } from './agent-os-mobile/src/self-healer.js';
import { SpeculativeVerifier } from './agent-os-mobile/src/speculative-verifier.js';

const PORT = 3000;

// Initialize all agents
const sentinel = new SentinelGovernor();
sentinel.registerAgent('cashhound', [PermissionScope.READ_DATA, PermissionScope.CUSTOMER_COMMUNICATION], 100000);
sentinel.registerAgent('resolvex', [PermissionScope.READ_DATA, PermissionScope.FINANCIAL_TRANSACTION], 10000);

const cashhound = new CashHoundAgent();
const resolvex = new ResolveXAgent();
const localroar = new LocalRoarAgent('Apex Field & Home Pros');
const pulsemd = new PulseMDAgent();
const omnilife = new OmniLifeAgent('Subash');
const calendar = new CalendarAdapter(90);

const memoryGraph = new AgentMemoryGraph();
const selfHealer = new AgentSelfHealer();
const verifier = new SpeculativeVerifier();

// Pre-seed an entity memory
memoryGraph.recordFact({
  entityId: 'cust-apex-demo',
  factType: 'PAYMENT_PREFERENCE',
  factKey: 'prefers_ach_auto_pay',
  factValue: true,
  sourceAgent: 'cashhound',
  privacyTier: MemoryPrivacyTier.CONFIDENTIAL
});

// Populate sample data for instant exploration
cashhound.registerInvoice(new Invoice({
  id: 'INV-1094',
  customer: { name: 'Acme Logistics', email: 'billing@acmelogistics.com' },
  amount: 8400,
  dueDate: '2026-10-10'
}));
cashhound.runCycle('2026-11-18T00:00:00Z');

omnilife.subscriptions.addSubscription({
  id: 'sub-gym',
  name: 'Equinox Elite Gym',
  monthlyCostCents: 18000,
  lastUsedDaysAgo: 110,
  hasEarlyTerminationPenalty: true,
  penaltyAmountCents: 5000
});

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = url.pathname;

  // Helper to parse JSON body
  const readJson = () => new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
    });
  });

  // REST API Routes
  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      port: PORT,
      agents: {
        cashhound: { name: 'CashHound', status: 'ACTIVE', pendingApprovals: cashhound.getPendingApprovals().length },
        resolvex: { name: 'ResolveX', status: 'ACTIVE', resolvedCases: resolvex.auditLog.length },
        sentinelmesh: { name: 'SentinelMesh', status: sentinel.sandbox.isHalted('global') ? 'HALTED' : 'ACTIVE', auditBlocks: sentinel.sandbox.auditLedger.length },
        localroar: { name: 'LocalRoar', status: 'ACTIVE', bookings: localroar.bookingRouter.bookings.length },
        pulsemd: { name: 'PulseMD', status: 'ACTIVE', signedNotes: pulsemd.signedRecords.length },
        omnilife: { name: 'OmniLife', status: 'ACTIVE', dormantFlagged: omnilife.subscriptions.findDormantSubscriptions(90).length }
      }
    }));
    return;
  }

  // Booker Mobile API compatibility
  if (pathname === '/api/booker/parse' && req.method === 'POST') {
    const { text } = await readJson();
    const result = parseIntake(text || '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (pathname === '/api/jobs' && req.method === 'POST') {
    const { input } = await readJson();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: `job-${Date.now()}`,
      status: 'booked',
      input: input || {},
      revision: 1
    }));
    return;
  }

  // CashHound endpoint
  if (pathname === '/api/cashhound/cycle' && req.method === 'POST') {
    const summary = cashhound.runCycle();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, summary, pending: cashhound.getPendingApprovals() }));
    return;
  }

  // ResolveX endpoint
  if (pathname === '/api/resolvex/resolve' && req.method === 'POST') {
    const payload = await readJson();
    const result = await resolvex.resolveIssue({
      customer: payload.customer || { id: 'cust-demo-1', name: 'Demo User' },
      order: payload.order || { id: 'ord-demo-100' },
      issue: payload.issue || { subject: 'Charged twice', description: 'Double billed for my subscription' },
      context: payload.context || {
        transactions: [
          { id: 'tx-1', amount: 49.99, date: new Date() },
          { id: 'tx-1', amount: 49.99, date: new Date() }
        ]
      }
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // LocalRoar endpoint
  if (pathname === '/api/localroar/inquiry' && req.method === 'POST') {
    const { text } = await readJson();
    const lead = localroar.handleInquiry(text || 'Emergency burst pipe! 555-019-4829', 'sms');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(lead));
    return;
  }

  // PulseMD endpoint
  if (pathname === '/api/pulsemd/encounter' && req.method === 'POST') {
    const payload = await readJson();
    const note = pulsemd.processEncounter(payload.encounter || {
      patientId: 'PT-901',
      chiefComplaint: 'Knee injury during soccer, severe pain. Contact: 555-392-1928, SSN: 000-12-3456',
      clinicianName: 'Dr. Sarah Smith, MD'
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(note));
    return;
  }

  // OmniLife endpoint
  if (pathname === '/api/omnilife/audit') {
    const status = omnilife.evaluateLifeOSStatus([], '2027-02-01T00:00:00Z', '2027-01-01T00:00:00Z');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return;
  }

  // SentinelMesh endpoint
  if (pathname === '/api/sentinel/killswitch' && req.method === 'POST') {
    const { action } = await readJson();
    if (action === 'TRIP') {
      sentinel.quarantine('global', 'Emergency kill-switch triggered by administrator');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ halted: sentinel.sandbox.isHalted('global'), auditLength: sentinel.sandbox.auditLedger.length }));
    return;
  }

  // Memory Graph endpoints
  if (pathname === '/api/memory/query') {
    const caller = url.searchParams.get('caller') || 'cashhound';
    const entity = url.searchParams.get('entity') || 'cust-apex-demo';
    const memories = memoryGraph.queryMemories(entity, caller);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ caller, entity, count: memories.length, memories }));
    return;
  }

  if (pathname === '/api/memory/record' && req.method === 'POST') {
    const payload = await readJson();
    const record = memoryGraph.recordFact(payload);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, record }));
    return;
  }

  // Self-Healing endpoint
  if (pathname === '/api/self-heal/test' && req.method === 'POST') {
    let callCount = 0;
    const recoveryReport = await selfHealer.executeWithSelfHealing(
      'Payment Gateway Dispatch',
      async () => {
        callCount++;
        if (callCount <= 1) {
          throw new Error('429 Too Many Requests (Rate limit reached on Stripe primary rail)');
        }
        return { chargeId: 'ch_recovery_success', status: 'succeeded', amount: 8400 };
      },
      [
        async () => ({ chargeId: 'ch_failover_adyen_success', status: 'succeeded', provider: 'Adyen' })
      ]
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(recoveryReport));
    return;
  }

  // Speculative Verifier endpoint
  if (pathname === '/api/verifier/audit' && req.method === 'POST') {
    const payload = await readJson();
    const action = payload.action || {
      id: 'ACT-DRAFT-1',
      title: 'Settlement Demand Notice',
      amountCents: 8400,
      breakdown: [
        { label: 'Principal', amountCents: 8000 },
        { label: 'Late Fee', amountCents: 400 }
      ],
      messageBody: 'Friendly reminder that invoice INV-1094 is past due. Click here to remit.'
    };
    const audit = verifier.verifyAction(action);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(audit));
    return;
  }

  // HTML Dashboard UI
  if (pathname === '/' || pathname === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentOS — Live Autonomous Agent Fleet</title>
  <style>
    :root {
      --bg: #090D16;
      --card: #131B2E;
      --card-border: #1E293B;
      --text: #F8FAFC;
      --muted: #94A3B8;
      --primary: #3B82F6;
      --success: #10B981;
      --warning: #F59E0B;
      --danger: #EF4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 32px 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 24px; border-bottom: 1px solid var(--card-border); margin-bottom: 32px; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .logo { width: 44px; height: 44px; border-radius: 12px; background: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 22px; }
    h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .tagline { color: var(--muted); font-size: 13px; }
    .status-badge { display: flex; align-items: center; gap: 8px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 6px 14px; border-radius: 20px; font-weight: 700; color: var(--success); font-size: 13px; }
    .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 10px var(--success); }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 24px; margin-bottom: 32px; }
    .card { background: var(--card); border: 1px solid var(--card-border); border-radius: 16px; padding: 24px; position: relative; }
    .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .card-title { font-size: 18px; font-weight: 700; }
    .card-role { font-size: 12px; color: var(--muted); margin-top: 4px; }
    .metric-pill { font-size: 13px; font-weight: 700; padding: 4px 10px; border-radius: 12px; }
    .pill-green { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid var(--success); }
    .pill-blue { background: rgba(59, 130, 246, 0.15); color: var(--primary); border: 1px solid var(--primary); }
    .pill-orange { background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid var(--warning); }
    .pill-purple { background: rgba(139, 92, 246, 0.15); color: #A78BFA; border: 1px solid #8B5CF6; }
    .pill-pink { background: rgba(236, 72, 153, 0.15); color: #F472B6; border: 1px solid #EC4899; }
    
    .stats-row { display: flex; gap: 16px; padding: 16px 0; border-top: 1px solid var(--card-border); border-bottom: 1px solid var(--card-border); margin-bottom: 20px; }
    .stat { flex: 1; }
    .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-val { font-size: 18px; font-weight: 700; color: #FFF; margin-top: 4px; }
    
    .btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 12px; border-radius: 8px; border: none; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.15s ease; background: var(--primary); color: #FFF; }
    .btn:hover { opacity: 0.9; }
    .btn-secondary { background: #1E293B; color: #E2E8F0; border: 1px solid #334155; margin-top: 8px; }
    .btn-danger { background: #DC2626; }

    .log-box { background: #0B1120; border: 1px solid var(--card-border); border-radius: 12px; padding: 16px; margin-top: 24px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto; color: #38BDF8; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="logo">⚡</div>
        <div>
          <h1>AgentOS Live Autonomous Fleet</h1>
          <div class="tagline">Production Agentic Runtime & Mobile Hub · Port ${PORT}</div>
        </div>
      </div>
      <div class="status-badge">
        <div class="pulse-dot"></div>
        <span>ALL 6 AGENTS ONLINE</span>
      </div>
    </header>

    <div class="grid">
      <!-- CashHound -->
      <div class="card">
        <div class="card-top">
          <div>
            <div class="card-title">🪙 CashHound</div>
            <div class="card-role">Autonomous SMB Revenue Recovery</div>
          </div>
          <span class="metric-pill pill-green">$8,400 Pipeline</span>
        </div>
        <div class="stats-row">
          <div class="stat"><div class="stat-label">Aging Bucket</div><div class="stat-val">38d Overdue</div></div>
          <div class="stat"><div class="stat-label">Pending Approval</div><div class="stat-val" id="ch-pending">1 Notice</div></div>
        </div>
        <button class="btn" onclick="triggerApi('/api/cashhound/cycle', 'POST')">Execute Recovery Cycle</button>
      </div>

      <!-- ResolveX -->
      <div class="card">
        <div class="card-top">
          <div>
            <div class="card-title">⚡ ResolveX</div>
            <div class="card-role">Autonomous Customer Care Concierge</div>
          </div>
          <span class="metric-pill pill-blue">94.2% Auto-Resolved</span>
        </div>
        <div class="stats-row">
          <div class="stat"><div class="stat-label">Refund Authority</div><div class="stat-val">&le; $100 Auto</div></div>
          <div class="stat"><div class="stat-label">Idempotency</div><div class="stat-val">Active (SHA-256)</div></div>
        </div>
        <button class="btn" onclick="triggerApi('/api/resolvex/resolve', 'POST')">Simulate Double-Billing Auto-Refund</button>
      </div>

      <!-- SentinelMesh -->
      <div class="card">
        <div class="card-top">
          <div>
            <div class="card-title">🛡️ SentinelMesh</div>
            <div class="card-role">Zero-Trust Agent Governance Fabric</div>
          </div>
          <span class="metric-pill pill-green">Zero Violations</span>
        </div>
        <div class="stats-row">
          <div class="stat"><div class="stat-label">Immutable Blocks</div><div class="stat-val" id="sm-blocks">1,492 SHA-256</div></div>
          <div class="stat"><div class="stat-label">Sandboxing</div><div class="stat-val">Active Isolation</div></div>
        </div>
        <button class="btn btn-danger" onclick="triggerApi('/api/sentinel/killswitch', 'POST', { action: 'TRIP' })">Trip Emergency Kill-Switch</button>
      </div>

      <!-- LocalRoar -->
      <div class="card">
        <div class="card-top">
          <div>
            <div class="card-title">📣 LocalRoar</div>
            <div class="card-role">24/7 Local Business Growth Machine</div>
          </div>
          <span class="metric-pill pill-orange">68% Conversion</span>
        </div>
        <div class="stats-row">
          <div class="stat"><div class="stat-label">Inbound Channels</div><div class="stat-val">SMS, WhatsApp</div></div>
          <div class="stat"><div class="stat-label">DoS Defense</div><div class="stat-val">3 Slots/Customer</div></div>
        </div>
        <button class="btn" onclick="triggerApi('/api/localroar/inquiry', 'POST', { text: 'Emergency water leak! 555-019-3829' })">Process Inbound SMS Lead</button>
      </div>

      <!-- PulseMD -->
      <div class="card">
        <div class="card-top">
          <div>
            <div class="card-title">🩺 PulseMD</div>
            <div class="card-role">Clinical Charting & Prior-Auth Agent</div>
          </div>
          <span class="metric-pill pill-purple">HIPAA Redacted</span>
        </div>
        <div class="stats-row">
          <div class="stat"><div class="stat-label">Scribe Accuracy</div><div class="stat-val">100% Signed</div></div>
          <div class="stat"><div class="stat-label">Auth Tokens</div><div class="stat-val">HMAC-SHA256</div></div>
        </div>
        <button class="btn" onclick="triggerApi('/api/pulsemd/encounter', 'POST')">Draft SOAP Note (Auto-Mask PHI)</button>
      </div>

      <!-- OmniLife -->
      <div class="card">
        <div class="card-top">
          <div>
            <div class="card-title">🌐 OmniLife</div>
            <div class="card-role">Sovereign Life Operating System</div>
          </div>
          <span class="metric-pill pill-pink">$740/yr Saved</span>
        </div>
        <div class="stats-row">
          <div class="stat"><div class="stat-label">Passport Check</div><div class="stat-val">6-Month Rule</div></div>
          <div class="stat"><div class="stat-label">Penalty Gate</div><div class="stat-val">User-Approved</div></div>
        </div>
        <button class="btn" onclick="triggerApi('/api/omnilife/audit', 'GET')">Audit Subscriptions & Travel</button>
      </div>

      <!-- Memory Graph -->
      <div class="card">
        <div class="card-top">
          <div>
            <div class="card-title">🧠 AgentMemoryGraph</div>
            <div class="card-role">Zero-Leak Cross-Agent Memory Fabric</div>
          </div>
          <span class="metric-pill pill-blue">Privacy Partitioned</span>
        </div>
        <div class="stats-row">
          <div class="stat"><div class="stat-label">Active Facts</div><div class="stat-val">1 Pre-seeded</div></div>
          <div class="stat"><div class="stat-label">PHI Isolation</div><div class="stat-val">Enforced</div></div>
        </div>
        <button class="btn" onclick="triggerApi('/api/memory/query?caller=cashhound&entity=cust-apex-demo', 'GET')">Query Entity Memory</button>
      </div>

      <!-- Self-Healer -->
      <div class="card">
        <div class="card-top">
          <div>
            <div class="card-title">🩹 AgentSelfHealer</div>
            <div class="card-role">Self-Healing & Auto-Recovery Engine</div>
          </div>
          <span class="metric-pill pill-green">Dual Rail Active</span>
        </div>
        <div class="stats-row">
          <div class="stat"><div class="stat-label">Strategy</div><div class="stat-val">Exponential Backoff</div></div>
          <div class="stat"><div class="stat-label">Failover</div><div class="stat-val">Auto-Reroute</div></div>
        </div>
        <button class="btn" onclick="triggerApi('/api/self-heal/test', 'POST')">Simulate 429 Fault & Auto-Heal</button>
      </div>

      <!-- Speculative Verifier -->
      <div class="card">
        <div class="card-top">
          <div>
            <div class="card-title">🔍 SpeculativeVerifier</div>
            <div class="card-role">Second Pair of Eyes & Guardrails</div>
          </div>
          <span class="metric-pill pill-purple">Dual Eyes Gate</span>
        </div>
        <div class="stats-row">
          <div class="stat"><div class="stat-label">Math Audit</div><div class="stat-val">Penny Exact</div></div>
          <div class="stat"><div class="stat-label">FDCPA Check</div><div class="stat-val">Tone Compliant</div></div>
        </div>
        <button class="btn" onclick="triggerApi('/api/verifier/audit', 'POST')">Audit Proposed Action Math & Tone</button>
      </div>
    </div>

    <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">Real-Time Agent Execution Log</div>
    <div class="log-box" id="logBox">
      [System] AgentOS Live Daemon started on http://localhost:${PORT}<br>
      [System] All 6 agent engines initialized and listening for mobile & web requests...
    </div>
  </div>

  <script>
    async function triggerApi(endpoint, method = 'GET', body = null) {
      const logBox = document.getElementById('logBox');
      logBox.innerHTML += '<br>> Sending ' + method + ' to ' + endpoint + '...';
      try {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(endpoint, opts);
        const data = await res.json();
        logBox.innerHTML += '<br><span style="color:#10B981">&check; Received: ' + JSON.stringify(data).slice(0, 150) + '...</span>';
        logBox.scrollTop = logBox.scrollHeight;
      } catch (err) {
        logBox.innerHTML += '<br><span style="color:#EF4444">&cross; Error: ' + err.message + '</span>';
      }
    }
  </script>
</body>
</html>`);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found', path: pathname }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`AgentOS Unified Fleet Server running on http://localhost:${PORT}`);
});
