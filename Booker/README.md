# Booker — Intake & Dispatch Agent

**Booker** is the customer inquiry intake, validation, and technician scheduling agent for field service operations.

## Capabilities

1. **Unstructured Inquiry Parsing:** Converts freeform text, chat messages, or call notes into normalized intake records.
2. **Strict Validation & Schema Enforcement:** Enforces customer, address, supported appliance category, and canonical ISO UTC timestamps.
3. **Currency Conversion:** Automatically converts INR values (`₹1,500`, `Rs. 1,500`) into integer paise (`150000`).
4. **Duration-Aware Scheduling:** Prevents appointment overlaps within a configurable duration window (default 90 min) with read-back verification.
5. **Authorization Gate:** Demands explicit owner approval before locking technician calendar slots.

## Usage

```javascript
import { parseIntake, CalendarAdapter, bookingAgent } from 'booker-agent';

// 1. Parse inquiry
const inquiry = `
Customer: Rajesh Kumar
Address: 42 Palm Grove Road, Bangalore
Appliance: Samsung front loader washing machine
Slot: 2026-12-01T10:00:00+05:30
Estimated charge: ₹1,500
Technician: tech-101
`;
const result = parseIntake(inquiry);

// 2. Reserve schedule
const calendar = new CalendarAdapter(90);
const reservation = calendar.reserve('tenant-1', 'tech-101', result.candidate.slot, 'job-001');

// 3. Evaluate Agent Decision
const nextStep = bookingAgent.next({ input: result.candidate });
```

## Testing

```sh
npm test
```
