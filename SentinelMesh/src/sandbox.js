import crypto from 'node:crypto';

/**
 * Deterministically sorts object keys for canonical cryptographic hashing.
 */
function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map(key => JSON.stringify(key) + ':' + canonicalizeJson(obj[key]));
  return '{' + entries.join(',') + '}';
}

/**
 * SentinelMesh Sandbox: Intercepts tool execution, enforces boundary isolation,
 * and maintains an append-only cryptographic audit ledger.
 */
export class ToolSandbox {
  constructor() {
    this._auditLedger = [];
    this._killSwitches = new Set();
  }

  get auditLedger() {
    return Object.freeze([...this._auditLedger]);
  }

  get killSwitches() {
    return new Set(this._killSwitches);
  }

  tripKillSwitch(agentId, reason) {
    this._killSwitches.add(agentId);
    this.recordAudit({
      agentId,
      action: 'KILL_SWITCH_TRIPPED',
      details: { reason },
      status: 'BLOCKED'
    });
  }

  isHalted(agentId) {
    return this._killSwitches.has(agentId);
  }

  recordAudit(entry) {
    const timestamp = new Date().toISOString();
    const prevHash = this._auditLedger.length > 0
      ? this._auditLedger[this._auditLedger.length - 1].blockHash
      : '0000000000000000000000000000000000000000000000000000000000000000';

    const rawBlock = {
      index: this._auditLedger.length,
      timestamp,
      ...entry,
      prevHash
    };

    // SEC-01: Canonical hashing ensures deterministic, tamper-evident SHA-256 verification
    const canonicalPayload = canonicalizeJson(rawBlock);
    const blockHash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');

    // Freeze block to prevent in-memory tampering
    const immutableBlock = Object.freeze({
      ...rawBlock,
      blockHash
    });

    this._auditLedger.push(immutableBlock);
    return immutableBlock;
  }

  async executeGuarded(agentId, policy, toolName, requiredScope, params, toolFn) {
    if (this.isHalted(agentId)) {
      this.recordAudit({
        agentId,
        action: toolName,
        status: 'REJECTED',
        reason: 'Agent execution halted by Sentinel kill-switch'
      });
      throw new Error(`Execution denied: Agent ${agentId} is quarantined by kill-switch`);
    }

    const authCheck = policy.isAuthorized(requiredScope, params);
    if (!authCheck.authorized) {
      this.recordAudit({
        agentId,
        action: toolName,
        status: authCheck.requiresHumanApproval ? 'PENDING_APPROVAL' : 'FORBIDDEN',
        reason: authCheck.reason,
        params
      });

      if (authCheck.requiresHumanApproval) {
        return {
          status: 'APPROVAL_REQUIRED',
          reason: authCheck.reason,
          gate: 'HUMAN_IN_THE_LOOP'
        };
      }

      throw new Error(`Access forbidden: ${authCheck.reason}`);
    }

    // Deep freeze input params to prevent tool tampering with caller state
    const safeParams = Object.freeze(JSON.parse(JSON.stringify(params || {})));

    try {
      const result = await toolFn(safeParams);
      this.recordAudit({
        agentId,
        action: toolName,
        status: 'SUCCESS',
        params: safeParams,
        resultSummary: typeof result === 'object' && result !== null ? Object.keys(result) : 'executed'
      });
      return { status: 'EXECUTED', result };
    } catch (err) {
      this.recordAudit({
        agentId,
        action: toolName,
        status: 'FAILED',
        error: err.message
      });
      throw err;
    }
  }

  verifyLedgerIntegrity() {
    for (let i = 0; i < this._auditLedger.length; i++) {
      const current = this._auditLedger[i];
      const prevHash = i === 0
        ? '0000000000000000000000000000000000000000000000000000000000000000'
        : this._auditLedger[i - 1].blockHash;

      if (current.prevHash !== prevHash) {
        return false;
      }

      const { blockHash, ...body } = current;
      const expectedHash = crypto.createHash('sha256').update(canonicalizeJson(body)).digest('hex');
      if (current.blockHash !== expectedHash) {
        return false;
      }
    }
    return true;
  }
}
