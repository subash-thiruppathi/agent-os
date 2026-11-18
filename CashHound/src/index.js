/**
 * CashHound - Autonomous SMB Revenue Recovery Agent
 * Primary module entry point.
 */

export {
  Invoice,
  AgingBuckets,
  InvoiceStatus,
  CustomerTier,
  PriorityLevel,
} from './invoice.js';

export {
  DunningTier,
  DunningTone,
  generateDunningMessage,
  calculateInstallmentPlan,
  calculateSettlementOffer,
  getRecommendedTier,
  resolveTone,
} from './dunning.js';

export {
  CashHoundAgent,
  ActionStatus,
  AgentDecisionType,
} from './agent.js';

export { CashHoundMobileAdapter } from './mobile.js';
export { SettlementNpvOptimizer, RECOVERY_PROBABILITIES } from './npv-optimizer.js';
export { BankFeedReconciler } from './bank-reconciler.js';
