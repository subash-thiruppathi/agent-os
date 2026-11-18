# LocalRoar — 24/7 Autonomous Growth Operator for Local Businesses

**LocalRoar** is the always-on operator that converts inbound customer inquiries into paying jobs, prevents booking collisions, requests five-star customer reviews, and compiles weekly revenue digests.

## Capabilities

1. **Omnichannel Lead Parsing:** Instantly extracts intent, emergency status, contact info, and matches against the business service catalog.
2. **Instant Dynamic Quotes:** Provides transparent, policy-compliant price estimates tailored for standard or emergency dispatches.
3. **Collision-Free Slot Booking:** Enforces calendar duration boundaries to prevent double-booking.
4. **Automated Review Velocity:** Triggers personalized SMS/email feedback outreach post-service to build local reputation.
5. **Executive Digest:** Provides owners with automated weekly conversion rates and pipeline volume.

## Usage

```javascript
import { LocalRoarAgent } from 'localroar-agent';

const agent = new LocalRoarAgent('Apex Plumbing & Heating');

// 1. Ingest inbound lead from web or SMS
const quote = agent.handleInquiry('Hi, pipe leaking under kitchen sink! Phone: 555-019-2834', 'sms');

// 2. Lock in slot
const reservation = agent.confirmBooking('David Miller', '2026-12-05T14:00:00Z', 'plumbing', 11250);

// 3. Review scheduled outreach
console.log(reservation.scheduledReviewOutreach.message);

// 4. View weekly digest
console.log(agent.generateWeeklyDigest());
```

## Testing

```sh
npm test
```
