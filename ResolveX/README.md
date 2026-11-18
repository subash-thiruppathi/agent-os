# ResolveX ⚡
### Autonomous Customer Resolution Agent

**ResolveX** is an agentic, policy-governed customer support resolution engine designed to resolve the full customer issue—not merely answer questions—by authenticating context, verifying entitlements, executing low-risk safe actions autonomously, and escalating high-value or exception cases to human reviewers.

---

## 🚀 Key Capabilities

- **Root-Cause Incident Diagnosis**: Automatically parses user intents and correlates them with telemetry, transaction histories, tracking APIs, and system outages (`DOUBLE_BILLING`, `SHIPPING_DELAY`, `PRODUCT_DEFECT`, `SERVICE_OUTAGE`, `INCORRECT_ITEM`).
- **Policy Engine & Guardrails**: Enforces strict financial limits (e.g., autonomous refunds $\le \$100$), return/warranty window verifications, and customer risk scoring.
- **Loyalty & Severity Multipliers**: Dynamically computes apology credits and vouchers based on customer loyalty tier (`STANDARD`, `BRONZE`, `SILVER`, `GOLD`, `PLATINUM`) and issue severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **Human-in-the-Loop (HITL) Escalation**: Automatically traps high-value refunds ($> \$100$), expired warranty claims, or suspicious abuse profiles into structured approval tickets with full audit trails.
- **Auditability & Observability**: Logs every ingestion, diagnosis signal, policy check, autonomous action, and human decision with immutable timestamps.
- **Zero External Dependencies**: Built with pure modern ES modules using Node.js built-ins (`node:test`, `node:assert`).

---

## 🏛 Architecture Overview

```
                                +-----------------------------+
                                |    Customer Inbound Issue   |
                                +--------------+--------------+
                                               |
                                               v
                                +-----------------------------+
                                |      Diagnosis Engine       |
                                |  (NLP + Telemetry Evidence) |
                                +--------------+--------------+
                                               |
                                               v
                                +-----------------------------+
                                |        Policy Engine        |
                                |  (Limits, Risk, Multipliers)|
                                +--------------+--------------+
                                               |
                       +-----------------------+-----------------------+
                       |                                               |
         [Low-Risk / Safe Action]                        [High-Risk / Exception]
         (e.g., Refund <= $100)                          (e.g., Refund > $100)
                       |                                               |
                       v                                               v
        +-----------------------------+                 +-----------------------------+
        |    Autonomous Execution     |                 |  Approval Ticket Generated  |
        |  (Refund, Replacement, etc) |                 |   (Pending Supervisor HITL) |
        +--------------+--------------+                 +--------------+--------------+
                       |                                               |
                       |                                               v
                       |                                +-----------------------------+
                       |                                | Human Review: Approve/Reject|
                       |                                +--------------+--------------+
                       |                                               |
                       +-----------------------+-----------------------+
                                               |
                                               v
                                +-----------------------------+
                                |  Immutable Audit Trail Log  |
                                +-----------------------------+
```

---

## 📦 Installation & Setup

ResolveX requires **Node.js v18+** with native ES modules support. No external `npm install` packages required.

```bash
git clone <repo-url> ResolveX
cd ResolveX
```

Run automated tests:
```bash
npm test
```

---

## 💡 Usage Examples

### 1. Autonomous Resolution (Double Billing < $100)

```javascript
import { ResolveXAgent, CustomerTier } from 'resolvex';

const agent = new ResolveXAgent();

const customer = {
  id: 'CUST-1001',
  name: 'Alice Johnson',
  tier: CustomerTier.SILVER,
  accountAgeDays: 180,
};

const order = {
  orderId: 'ORD-5501',
  total: 80.0,
  transactions: [
    { id: 'tx-001', amount: 40.0, timestamp: '2026-11-18T08:00:00Z' },
    { id: 'tx-002', amount: 40.0, timestamp: '2026-11-18T08:01:00Z' },
  ],
};

const issue = {
  description: 'I was charged twice $40 for the monthly plan.',
  amount: 40.0,
};

const resolution = await agent.resolveIssue({ customer, order, issue });
console.log(resolution.status); 
// => "RESOLVED_AUTONOMOUSLY"
// => Executes $40 refund + $31.25 Silver apology credit
```

---

### 2. Human-in-the-Loop Escalation (High-Value Refund > $100)

```javascript
import { ResolveXAgent, CustomerTier } from 'resolvex';

const agent = new ResolveXAgent();

const customer = {
  id: 'CUST-4004',
  name: 'David Miller',
  tier: CustomerTier.STANDARD,
};

const order = {
  orderId: 'ORD-9904',
  total: 500.0,
  transactions: [
    { id: 'tx-A', amount: 250.0, timestamp: '2026-11-15T12:00:00Z' },
    { id: 'tx-B', amount: 250.0, timestamp: '2026-11-15T12:02:00Z' },
  ],
};

const issue = {
  description: 'Charged twice $250 each for the annual subscription.',
  amount: 250.0,
};

// 1. Agent detects refund exceeds $100 threshold and triggers HITL ticket
const resolution = await agent.resolveIssue({ customer, order, issue });
console.log(resolution.status); 
// => "REQUIRES_APPROVAL"
console.log(resolution.ticketId); 
// => "TICK-XXXX-YYYY"

// 2. Supervisor inspects pending queue and approves
const approval = await agent.approveTicket(resolution.ticketId, {
  reviewerId: 'SUPERVISOR_SARAH',
  notes: 'Confirmed Stripe duplicate payment error; approved refund.',
});

console.log(approval.status); 
// => "RESOLVED_BY_APPROVAL"
```

---

### 3. Supervisor Rejection with Courtesy Alternative

```javascript
// Supervisor can decline full refund on out-of-warranty claims,
// but optionally offer a courtesy store voucher
const rejection = await agent.rejectTicket(ticketId, {
  reviewerId: 'SUPERVISOR_MIKE',
  reason: 'Item purchased over 1 year ago (out of warranty)',
  alternativeAction: {
    type: 'APOLOGY_CREDIT',
    amount: 50.0,
    currency: 'USD',
    breakdown: 'Courtesy store credit',
  },
});
```

---

### 4. Querying the Immutable Audit Trail

```javascript
const auditTrail = agent.getAuditLog({ caseId: resolution.caseId });
console.log(auditTrail);
/*
[
  { id: 'AUD-...', stage: 'INGESTION', action: 'ISSUE_INGESTED', ... },
  { id: 'AUD-...', stage: 'DIAGNOSIS', action: 'DIAGNOSIS_COMPLETED', ... },
  { id: 'AUD-...', stage: 'POLICY_EVALUATION', action: 'PLAN_PROPOSED', ... },
  { id: 'AUD-...', stage: 'ESCALATION', action: 'HUMAN_APPROVAL_REQUESTED', ... },
  { id: 'AUD-...', stage: 'HUMAN_IN_THE_LOOP', action: 'TICKET_APPROVED_AND_EXECUTED', ... }
]
*/
```

---

### 5. Computer Vision Damage Assessment (`DamageVerifier`)

Autonomously verifies photo evidence metadata, clarity, and physical damage types (`CRACKED_SCREEN`, `WATER_DAMAGE`, `SHATTERED_CASING`, `PHYSICAL_DEFORMATION`), detecting fraud and generating expedited replacement authorizations:

```javascript
import { DamageVerifier, DamageType } from 'resolvex';

const verifier = new DamageVerifier();
const evaluation = verifier.evaluatePhoto({
  photoId: 'PHOTO-101',
  width: 1920,
  height: 1080,
  clarityScore: 0.94,
  detectedDamageTypes: [DamageType.CRACKED_SCREEN],
  exif: { deviceModel: 'iPhone 15 Pro', timestamp: '2026-11-18T10:00:00Z' }
});

if (evaluation.valid) {
  const authorization = verifier.generateReplacementAuthorization({
    evaluation,
    claim: { id: 'CLM-101' },
    customer: { id: 'CUST-202' },
    item: { sku: 'PROD-PHONE-01', serialNumber: 'SN-12345' }
  });
  console.log(authorization.authorizationCode); // AUTH-REPL-...
}
```

---

### 6. Proactive Carrier Tracking & Auto-Remediation (`CarrierWebhookListener`)

Ingests FedEx, UPS, and DHL webhooks, detects critical transit exceptions (`WEATHER_EXCEPTION`, `TRANSIT_STALL_48H`, `CUSTOMS_HOLD`), and dispatches priority traces and loyalty apology credits before the customer ever files a ticket:

```javascript
import { CarrierWebhookListener, CarrierExceptionType } from 'resolvex';

const listener = new CarrierWebhookListener();

// Ingest webhook event from FedEx, UPS, or DHL
const outcome = listener.ingestWebhook({
  carrier: 'FedEx',
  trackingNumber: 'FX-9876543210',
  customerId: 'CUST-1001',
  eventType: 'EXCEPTION',
  exceptionCode: 'WEATHER_DELAY',
  statusDescription: 'Severe blizzard in central sorting hub'
});

console.log(outcome.proactiveActionTaken); // true
console.log(outcome.dispatchedActions); // [PRIORITY_CARRIER_TRACE, PROACTIVE_LOYALTY_CREDIT]
```

---

## 🧪 Testing

Run the test suite using Node's native test runner:

```bash
npm test
```

Tests cover:
- Policy engine limits, warranty boundaries, loyalty calculations, and fraud detection.
- Natural language intent classification and multi-signal telemetry verification.
- Autonomous resolutions for billing, delivery delays, and defective products.
- Human-in-the-loop supervisor approvals, rejections, and alternate remedies.
- Audit trail completeness and tamper-evident structure.

---

## 📜 License
MIT
