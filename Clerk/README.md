# Clerk — Settlement & Warranty Resolution Agent

**Clerk** resolves the financial and warranty closure for field visits, ensuring estimate reconciliation, invoice generation, and proof-backed payment verification.

## Capabilities

1. **Charge Reconciliation:** Verifies that reported work and parts charges exactly match accepted estimates. Blocks unapproved upcharges.
2. **Invoicing & Approvals:** Prepares verified invoice drafts and requires owner authorization prior to release.
3. **Payment Verification:** Matches incoming payment amount, currency (INR), and transaction reference against the specific invoice ID.
4. **Warranty Resolution:** Prepares warranty claim packages with bound technician evidence for insurer/manufacturer review.

## Usage

```javascript
import { settlementAgent, SettlementReconciler } from 'clerk-agent';

const reconciler = new SettlementReconciler();
const invoice = reconciler.issueInvoice('tenant-1', 'job-001', 150000, 'INR');

// Record and verify payment
reconciler.recordPayment('tenant-1', 'job-001', invoice.id, 150000, 'INR', 'pay_ref_123');
const check = reconciler.verifyPayment('tenant-1', 'job-001');
// check.verified === true
```

## Testing

```sh
npm test
```
