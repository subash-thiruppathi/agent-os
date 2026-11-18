# OmniLife — Autonomous Life Operating System Agent

**OmniLife** is the personal life operator that manages administrative overhead across subscriptions, travel validity, calendar conflicts, and financial commitments—with clear human-in-the-loop safeguards.

## Capabilities

1. **Dormant Subscription Pruning:** Discovers recurring subscriptions unused for 90+ days and evaluates annual cost savings.
2. **Termination Penalty Guard:** Identifies cancellation penalties and pauses for explicit user approval before terminating contracts.
3. **Passport & Travel Compliance:** Verifies that passport expiration complies with international 6-month validity rules before flights.
4. **Collision Resolver:** Detects overlapping meetings and itineraries.

## Usage

```javascript
import { OmniLifeAgent } from 'omnilife-agent';

const agent = new OmniLifeAgent('Alex');

// 1. Register subscription
agent.subscriptions.addSubscription({
  name: 'Gym Club',
  monthlyCostCents: 6000,
  lastUsedDaysAgo: 120,
  hasEarlyTerminationPenalty: true,
  penaltyAmountCents: 5000
});

// 2. Audit life operations
const status = agent.evaluateLifeOSStatus([], '2027-02-01T00:00:00Z', '2027-01-01T00:00:00Z');

// 3. User approves cancellation
agent.approveCancellation(status.pendingApprovals[0].subscription.id, true);
```

## Testing

```sh
npm test
```
