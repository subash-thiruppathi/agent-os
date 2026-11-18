import { randomUUID } from 'node:crypto';

/**
 * Booker Calendar Adapter
 * Enforces duration-aware overlap detection, idempotent reservations, and read-back verification.
 */
export class CalendarAdapter {
  constructor(defaultDurationMinutes = 90) {
    this.defaultDurationMinutes = defaultDurationMinutes;
    this.reservations = new Map();
  }

  #key(tenant, technician) {
    return `${tenant}:${technician}`;
  }

  reserve(tenant, technician, slotIso, jobId, durationMinutes = this.defaultDurationMinutes) {
    const startMs = Date.parse(slotIso);
    if (!Number.isFinite(startMs)) throw new Error('Invalid slot timestamp for calendar adapter');
    const endMs = startMs + durationMinutes * 60 * 1000;
    const key = this.#key(tenant, technician);

    const list = this.reservations.get(key) ?? [];

    const existingForJob = list.find(r => r.jobId === jobId);
    if (existingForJob) {
      if (existingForJob.startMs === startMs && existingForJob.endMs === endMs) {
        return { id: existingForJob.id, verified: true, slot: slotIso, startMs, endMs };
      }
      throw new Error('Job already has an active conflicting reservation at another time');
    }

    const overlap = list.find(r => startMs < r.endMs && endMs > r.startMs);
    if (overlap) {
      throw new Error(`Technician ${technician} has a schedule conflict with job ${overlap.jobId} until ${new Date(overlap.endMs).toISOString()}`);
    }

    const reservation = {
      id: randomUUID(),
      jobId,
      slotIso,
      startMs,
      endMs,
      verified: true,
      simulated: true
    };

    list.push(reservation);
    this.reservations.set(key, list);

    const verified = this.reservations.get(key)?.find(r => r.id === reservation.id);
    if (!verified) throw new Error('Calendar write failed read-back verification');

    return { id: reservation.id, verified: true, slot: slotIso, startMs, endMs };
  }

  release(tenant, technician, jobId) {
    const key = this.#key(tenant, technician);
    const list = this.reservations.get(key);
    if (!list) return false;
    const initialLen = list.length;
    const filtered = list.filter(r => r.jobId !== jobId);
    this.reservations.set(key, filtered);
    return filtered.length < initialLen;
  }

  isAvailable(tenant, technician, slotIso, durationMinutes = this.defaultDurationMinutes) {
    const startMs = Date.parse(slotIso);
    if (!Number.isFinite(startMs)) return false;
    const endMs = startMs + durationMinutes * 60 * 1000;
    const key = this.#key(tenant, technician);
    const list = this.reservations.get(key) ?? [];
    return !list.some(r => startMs < r.endMs && endMs > r.startMs);
  }
}
