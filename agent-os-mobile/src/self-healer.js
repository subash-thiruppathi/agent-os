/**
 * AgentOS Self-Healing & Auto-Recovery Engine:
 * Catches tool/API faults, executes intelligent backoff retries, and switches
 * to secondary alternate rails automatically without crashing agent workflows.
 */

export const FaultSignature = Object.freeze({
  TRANSIENT_NETWORK: 'TRANSIENT_NETWORK',
  RATE_LIMIT_429: 'RATE_LIMIT_429',
  RAIL_UNAVAILABLE: 'RAIL_UNAVAILABLE',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  FATAL_LOGIC: 'FATAL_LOGIC'
});

export class AgentSelfHealer {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 2;
    this.baseDelayMs = options.baseDelayMs || 50;
    this.healingAuditLog = [];
  }

  classifyError(err) {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
      return FaultSignature.RATE_LIMIT_429;
    }
    if (msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('timeout') || msg.includes('network')) {
      return FaultSignature.TRANSIENT_NETWORK;
    }
    if (msg.includes('unavailable') || msg.includes('service down') || msg.includes('outage') || msg.includes('503')) {
      return FaultSignature.RAIL_UNAVAILABLE;
    }
    if (msg.includes('unauthorized') || msg.includes('token expired') || msg.includes('401')) {
      return FaultSignature.AUTH_EXPIRED;
    }
    return FaultSignature.FATAL_LOGIC;
  }

  async executeWithSelfHealing(taskName, primaryRailFn, failoverRails = [], options = {}) {
    const startTime = Date.now();
    let attempts = 0;
    const history = [];

    // 1. Try Primary Rail with Exponential Backoff
    while (attempts <= this.maxRetries) {
      attempts++;
      try {
        const result = await primaryRailFn();
        return {
          status: attempts === 1 ? 'SUCCESS_PRIMARY' : 'RECOVERED_VIA_RETRY',
          taskName,
          attempts,
          railUsed: 'PRIMARY',
          result,
          latencyMs: Date.now() - startTime
        };
      } catch (err) {
        const fault = this.classifyError(err);
        history.push({ rail: 'PRIMARY', attempt: attempts, fault, error: err.message });

        if (fault === FaultSignature.FATAL_LOGIC || attempts > this.maxRetries) {
          break; // Exit retry loop and evaluate failovers
        }

        // Exponential backoff delay
        const delay = this.baseDelayMs * Math.pow(2, attempts - 1);
        await new Promise(res => setTimeout(res, delay));
      }
    }

    // 2. Failover to Alternate Secondary Rails
    for (let i = 0; i < failoverRails.length; i++) {
      const failover = failoverRails[i];
      const railName = failover.name || `FAILOVER_RAIL_${i + 1}`;
      try {
        const result = await failover.fn();
        const record = {
          status: 'RECOVERED_VIA_FAILOVER',
          taskName,
          totalAttempts: attempts + i + 1,
          railUsed: railName,
          result,
          faultsOvercome: history,
          latencyMs: Date.now() - startTime
        };
        this.healingAuditLog.push(record);
        return record;
      } catch (err) {
        history.push({ rail: railName, fault: this.classifyError(err), error: err.message });
      }
    }

    // 3. Graceful Degradation / Fallback Action
    const failureRecord = {
      status: 'SELF_HEALING_EXHAUSTED',
      taskName,
      history,
      latencyMs: Date.now() - startTime,
      message: `Self-healing exhausted across primary and ${failoverRails.length} alternate rails.`
    };
    this.healingAuditLog.push(failureRecord);
    throw new Error(failureRecord.message);
  }
}
