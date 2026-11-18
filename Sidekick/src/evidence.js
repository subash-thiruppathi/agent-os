import { randomUUID } from 'node:crypto';

/**
 * Sidekick Evidence Registry
 * Handles registration and binding of on-site photo and checklist evidence to jobs.
 */
export class EvidenceRegistry {
  constructor() {
    // Map: `${tenant}:${jobId}` -> Set<string>
    this.store = new Map();
  }

  register(tenant, jobId, label, actor) {
    if (typeof label !== 'string' || !label.trim()) throw new Error('Evidence label required');
    const key = `${tenant}:${jobId}`;
    const evidenceList = this.store.get(key) ?? [];
    if (evidenceList.length >= 20) throw new Error('Evidence quota exceeded (max 20 items per job)');

    const record = {
      id: randomUUID(),
      tenant,
      jobId,
      label: label.trim(),
      actor,
      registeredAt: new Date().toISOString()
    };

    evidenceList.push(record);
    this.store.set(key, evidenceList);
    return record;
  }

  validateJobEvidence(tenant, jobId, evidenceIds) {
    if (!Array.isArray(evidenceIds)) throw new Error('Evidence must be an array of IDs');
    if (evidenceIds.length === 0) throw new Error('At least one evidence item is required');
    const key = `${tenant}:${jobId}`;
    const registered = (this.store.get(key) ?? []).map(e => e.id);
    for (const id of evidenceIds) {
      if (!registered.includes(id)) {
        throw new Error(`Evidence ID ${id} is not registered for job ${jobId}`);
      }
    }
    return true;
  }
}
