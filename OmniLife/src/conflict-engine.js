/**
 * OmniLife Conflict & Deadline Engine: Discovers travel passport validity windows and calendar collisions.
 */

export class ConflictEngine {
  checkPassportValidity(passportExpiryIso, departureDateIso) {
    const expiry = new Date(passportExpiryIso).getTime();
    const departure = new Date(departureDateIso).getTime();

    // 6-month validity rule standard for international travel
    const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
    const remainingTime = expiry - departure;

    if (remainingTime < sixMonthsMs) {
      const daysLeft = Math.floor(remainingTime / (24 * 60 * 60 * 1000));
      return {
        compliant: false,
        severity: 'CRITICAL',
        issue: `Passport expires within ${daysLeft} days of travel. Minimum 6 months (180 days) validity required by immigration.`,
        recommendedAction: 'EXPEDITE_PASSPORT_RENEWAL'
      };
    }

    return { compliant: true };
  }

  detectCalendarConflicts(events = []) {
    const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const conflicts = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      const currentEnd = new Date(current.end).getTime();
      const nextStart = new Date(next.start).getTime();

      if (currentEnd > nextStart) {
        conflicts.push({
          eventA: current,
          eventB: next,
          overlapMinutes: Math.round((currentEnd - nextStart) / (60 * 1000))
        });
      }
    }

    return conflicts;
  }
}
