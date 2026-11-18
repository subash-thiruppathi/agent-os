import { AccessPolicy, PermissionScope, RiskLevel } from './policy.js';
import { ToolSandbox } from './sandbox.js';

/**
 * SentinelMesh Governor: Super-agent that monitors and enforces trust policies across sub-agents.
 */
export class SentinelGovernor {
  constructor() {
    this.sandbox = new ToolSandbox();
    this.registeredAgents = new Map();
    this.failureCounters = new Map();
    this.failureThreshold = 3;
  }

  registerAgent(agentId, allowedScopes = [], spendingLimit = 0) {
    const policy = new AccessPolicy(agentId, allowedScopes, spendingLimit);
    this.registeredAgents.set(agentId, policy);
    this.failureCounters.set(agentId, 0);
    this.sandbox.recordAudit({
      agentId,
      action: 'AGENT_REGISTERED',
      details: { allowedScopes, spendingLimit },
      status: 'INITIALIZED'
    });
    return policy;
  }

  getPolicy(agentId) {
    const policy = this.registeredAgents.get(agentId);
    if (!policy) throw new Error(`Agent ${agentId} is not registered with Sentinel`);
    return policy;
  }

  async runStep(agentId, toolName, requiredScope, params, toolFn) {
    const policy = this.getPolicy(agentId);

    try {
      const outcome = await this.sandbox.executeGuarded(agentId, policy, toolName, requiredScope, params, toolFn);
      if (outcome.status === 'EXECUTED') {
        this.failureCounters.set(agentId, 0); // reset on success
      }
      return outcome;
    } catch (err) {
      const fails = (this.failureCounters.get(agentId) || 0) + 1;
      this.failureCounters.set(agentId, fails);

      if (fails >= this.failureThreshold) {
        this.sandbox.tripKillSwitch(agentId, `Exceeded consecutive failure threshold (${this.failureThreshold})`);
      }
      throw err;
    }
  }

  quarantine(agentId, reason) {
    this.sandbox.tripKillSwitch(agentId, reason);
  }

  getAuditTrail(agentId) {
    return this.sandbox.auditLedger.filter(b => b.agentId === agentId);
  }
}
