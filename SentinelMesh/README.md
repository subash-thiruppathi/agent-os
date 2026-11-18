# SentinelMesh — Enterprise Agent Trust, Sandboxing & Governance Layer

**SentinelMesh** is the mission-critical trust fabric for autonomous enterprise agents. It enforces fine-grained capability boundaries, progressive autonomy limits, cryptographic audit ledgers, and emergency kill-switches.

## Core Capabilities

1. **Least-Privilege Scoping:** Restricts agent capabilities to strictly defined permissions (`read:data`, `write:data`, `transact:financial`, etc.).
2. **Deterministic Risk Evaluation:** Dynamically scores tool invocations into Low, Medium, High, or Critical tiers.
3. **Progressive Autonomy & Human Gates:** Reversible/low-cost actions run autonomously, while actions exceeding policy limits automatically pause at human-in-the-loop checkpoints.
4. **Append-Only Tamper-Evident Audit Ledger:** Every agent action, input parameter, status, and policy check is hashed sequentially into a SHA-256 verifiable chain.
5. **Circuit Breakers & Kill-Switches:** Automatically quarantines agents that trigger repeated faults or anomaly thresholds.

## Usage

```javascript
import { SentinelGovernor, PermissionScope } from 'sentinelmesh-agent';

const governor = new SentinelGovernor();

// 1. Register agent with bounded financial authority ($50.00 / 5000 cents)
governor.registerAgent('support-agent-01', [
  PermissionScope.READ_DATA,
  PermissionScope.FINANCIAL_TRANSACTION
], 5000);

// 2. Safe transaction runs autonomously
const res = await governor.runStep(
  'support-agent-01',
  'issue_credit',
  PermissionScope.FINANCIAL_TRANSACTION,
  { amount: 2500, customerId: 'cust-99' },
  async (params) => ({ credited: params.amount })
);
// res.status === 'EXECUTED'

// 3. High-value transaction stops at Human-in-the-Loop approval gate
const highRes = await governor.runStep(
  'support-agent-01',
  'issue_credit',
  PermissionScope.FINANCIAL_TRANSACTION,
  { amount: 15000, customerId: 'cust-99' },
  async (params) => ({ credited: params.amount })
);
// highRes.status === 'APPROVAL_REQUIRED'
```

## Testing

```sh
npm test
```
