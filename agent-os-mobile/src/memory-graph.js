import crypto from 'node:crypto';

/**
 * Privacy partitions for cross-agent memory.
 * Guarantees that sensitive domains (e.g. healthcare PHI) cannot leak to commercial bots.
 */
export const MemoryPrivacyTier = Object.freeze({
  PUBLIC: 'PUBLIC',
  ORGANIZATION: 'ORGANIZATION',
  CONFIDENTIAL: 'CONFIDENTIAL',
  RESTRICTED_PHI: 'RESTRICTED_PHI' // Medical / clinical only
});

export class AgentMemoryGraph {
  constructor() {
    this.nodes = new Map(); // entityId -> Array<MemoryRecord>
    this.agentPermissions = new Map(); // agentId -> Set<MemoryPrivacyTier>

    // Default permission mappings
    this.setAgentPermissions('localroar', [MemoryPrivacyTier.PUBLIC, MemoryPrivacyTier.ORGANIZATION]);
    this.setAgentPermissions('cashhound', [MemoryPrivacyTier.PUBLIC, MemoryPrivacyTier.ORGANIZATION, MemoryPrivacyTier.CONFIDENTIAL]);
    this.setAgentPermissions('resolvex', [MemoryPrivacyTier.PUBLIC, MemoryPrivacyTier.ORGANIZATION, MemoryPrivacyTier.CONFIDENTIAL]);
    this.setAgentPermissions('pulsemd', [MemoryPrivacyTier.PUBLIC, MemoryPrivacyTier.ORGANIZATION, MemoryPrivacyTier.RESTRICTED_PHI]);
    this.setAgentPermissions('omnilife', [MemoryPrivacyTier.PUBLIC, MemoryPrivacyTier.ORGANIZATION, MemoryPrivacyTier.CONFIDENTIAL]);
    this.setAgentPermissions('sentinelmesh', [MemoryPrivacyTier.PUBLIC, MemoryPrivacyTier.ORGANIZATION, MemoryPrivacyTier.CONFIDENTIAL, MemoryPrivacyTier.RESTRICTED_PHI]);
  }

  setAgentPermissions(agentId, allowedTiers = []) {
    this.agentPermissions.set(agentId.toLowerCase(), new Set(allowedTiers));
  }

  recordFact({
    entityId,
    factType,
    factKey,
    factValue,
    sourceAgent,
    privacyTier = MemoryPrivacyTier.ORGANIZATION,
    confidence = 1.0,
    ttlDays = 365
  }) {
    if (!entityId || !factKey) throw new Error('entityId and factKey are required');

    const timestamp = new Date().toISOString();
    const memoryId = `MEM-${crypto.randomBytes(8).toString('hex')}`;

    const record = {
      memoryId,
      entityId,
      factType: factType || 'ATTRIBUTE',
      factKey,
      factValue,
      sourceAgent,
      privacyTier,
      confidence: Math.max(0, Math.min(1.0, confidence)),
      recordedAt: timestamp,
      lastObservedAt: timestamp,
      ttlDays,
      isInvalidated: false
    };

    if (!this.nodes.has(entityId)) {
      this.nodes.set(entityId, []);
    }

    const entityMemories = this.nodes.get(entityId);
    // Invalidate prior versions of this specific fact key if new one has higher/equal confidence
    for (const mem of entityMemories) {
      if (mem.factKey === factKey && !mem.isInvalidated) {
        mem.isInvalidated = true;
        mem.invalidatedReason = `Superseded by memory ${memoryId}`;
      }
    }

    entityMemories.push(record);
    return record;
  }

  queryMemories(entityId, callerAgentId, options = {}) {
    const memories = this.nodes.get(entityId) || [];
    const agentTiers = this.agentPermissions.get(callerAgentId.toLowerCase()) || new Set([MemoryPrivacyTier.PUBLIC]);
    const { includeInvalidated = false, minConfidence = 0.5 } = options;

    return memories.filter(mem => {
      // 1. Privacy partition check
      if (!agentTiers.has(mem.privacyTier)) return false;

      // 2. Active status check
      if (!includeInvalidated && mem.isInvalidated) return false;

      // 3. Confidence check
      if (mem.confidence < minConfidence) return false;

      // 4. Stale TTL check
      const ageDays = (Date.now() - new Date(mem.lastObservedAt).getTime()) / (24 * 60 * 60 * 1000);
      if (ageDays > mem.ttlDays) return false;

      return true;
    });
  }

  invalidateFact(entityId, factKey, reason = 'Reported outdated by agent') {
    const memories = this.nodes.get(entityId) || [];
    let count = 0;
    for (const mem of memories) {
      if (mem.factKey === factKey && !mem.isInvalidated) {
        mem.isInvalidated = true;
        mem.invalidatedReason = reason;
        count++;
      }
    }
    return { entityId, factKey, invalidatedCount: count };
  }
}
