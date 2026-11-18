/**
 * SentinelMesh Policy Engine: Least-privilege permission matrix and risk scoring.
 */

export const PermissionScope = {
  READ_DATA: 'read:data',
  WRITE_DATA: 'write:data',
  EXECUTE_TOOL: 'execute:tool',
  FINANCIAL_TRANSACTION: 'transact:financial',
  CUSTOMER_COMMUNICATION: 'communicate:customer',
  SYSTEM_CONFIG: 'system:config'
};

export const RiskLevel = {
  LOW: 'LOW',         // Read-only, safe diagnostics
  MEDIUM: 'MEDIUM',   // Internal writes, draft generation
  HIGH: 'HIGH',       // Customer-facing messages, refunds under threshold
  CRITICAL: 'CRITICAL' // Financial disbursements, deletions, permission changes
};

export class AccessPolicy {
  constructor(agentId, allowedScopes = [PermissionScope.READ_DATA], spendingLimit = 0) {
    this.agentId = agentId;
    this.allowedScopes = new Set(allowedScopes);
    this.spendingLimit = spendingLimit; // In cents/paise
  }

  isAuthorized(scope, metadata = {}) {
    if (!this.allowedScopes.has(scope)) {
      return { authorized: false, reason: `Agent missing required scope: ${scope}` };
    }

    if (scope === PermissionScope.FINANCIAL_TRANSACTION) {
      const amount = metadata.amount;

      // SEC-03: Strict validation against negative values, non-integers, NaN, Infinity, and type-coercion attacks
      if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
        return {
          authorized: false,
          reason: 'Invalid transaction amount: must be positive safe integer in minor currency units'
        };
      }

      if (amount > this.spendingLimit) {
        return {
          authorized: false,
          requiresHumanApproval: true,
          reason: `Transaction amount $${(amount / 100).toFixed(2)} exceeds agent limit $${(this.spendingLimit / 100).toFixed(2)}`
        };
      }
    }

    return { authorized: true };
  }

  evaluateRisk(toolName, params = {}) {
    if (params.amount && params.amount > 100000) return RiskLevel.CRITICAL;
    if (toolName.includes('refund') || toolName.includes('transfer')) return RiskLevel.HIGH;
    if (toolName.includes('send') || toolName.includes('notify')) return RiskLevel.MEDIUM;
    if (toolName.includes('read') || toolName.includes('fetch') || toolName.includes('query')) return RiskLevel.LOW;
    return RiskLevel.MEDIUM;
  }
}
