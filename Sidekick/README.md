# Sidekick — Field Job Completion Companion

**Sidekick** is the field technician companion agent for on-site execution, checklist verification, diagnostic media capture, and customer sign-off.

## Capabilities

1. **Checklist Enforcement:** Guarantees mandatory checklist items are marked complete before handoff.
2. **Customer Acknowledgement:** Requires explicit customer sign-off flag before advancing to billing.
3. **Evidence Binding:** Validates that photos, test diagnostics, and media are bound to the exact tenant and job ID.
4. **Resolution Guardrail:** Blocks unresolved jobs from proceeding to settlement without explicit follow-up assignment.

## Usage

```javascript
import { fieldAgent, reportSchema, EvidenceRegistry } from 'sidekick-agent';

// 1. Register evidence on-site
const registry = new EvidenceRegistry();
const photo = registry.register('tenant-1', 'job-001', 'motor replacement test photo', 'tech-101');

// 2. Validate technician report
const report = {
  checklistComplete: true,
  customerAcknowledged: true,
  amount: 150000,
  unresolved: false
};
reportSchema(report);
registry.validateJobEvidence('tenant-1', 'job-001', [photo.id]);

// 3. Evaluate Agent Decision
const next = fieldAgent.next({
  report,
  evidence: [photo.id]
});
// next.transition === 'settlement'
```

## Testing

```sh
npm test
```
