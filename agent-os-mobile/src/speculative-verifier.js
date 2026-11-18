/**
 * AgentOS Speculative Verifier ("Second Pair of Eyes"):
 * Audits proposed agent actions before they hit the human approval stack.
 * Verifies exact math reconciliation, tone safety, and policy compliance.
 */

export const PROHIBITED_COLLECTION_PATTERNS = [
  /police/i,
  /arrest/i,
  /jail/i,
  /criminal charges/i,
  /law enforcement/i,
  /seize your property/i,
  /bankrupt you/i
];

export class SpeculativeVerifier {
  verifyAction(action) {
    const issues = [];
    let score = 100;

    // 1. Math Verification
    if (action.amountCents !== undefined) {
      if (!Number.isSafeInteger(action.amountCents) || action.amountCents <= 0) {
        issues.push('Math Violation: Amount must be a positive integer in minor units');
        score -= 40;
      }

      if (action.breakdown && Array.isArray(action.breakdown)) {
        const sumParts = action.breakdown.reduce((sum, item) => sum + (item.amountCents || 0), 0);
        if (sumParts !== action.amountCents) {
          issues.push(`Math Discrepancy: Breakdown sum ($${(sumParts / 100).toFixed(2)}) does not match total ($${(action.amountCents / 100).toFixed(2)})`);
          score -= 30;
        }
      }
    }

    // 2. Prohibited Tone & Coercion Audit
    const textToScan = `${action.title || ''} ${action.description || ''} ${action.messageBody || ''}`;
    for (const pattern of PROHIBITED_COLLECTION_PATTERNS) {
      if (pattern.test(textToScan)) {
        issues.push(`Compliance Violation: Coercive/prohibited debt collection phrase detected (${pattern.source})`);
        score -= 50;
        break;
      }
    }

    // 3. Authority Threshold Check
    if (action.amountCents && action.amountCents > 1000000) {
      // Amounts > $10,000 flagged for executive review
      issues.push('High-Exposure Transaction: Requires secondary executive dual-control signature');
      score -= 15;
    }

    const normalizedScore = Math.max(0, score);
    const verified = normalizedScore >= 85 && issues.length === 0;

    return {
      actionId: action.id,
      verified,
      policyAlignmentScore: normalizedScore,
      passedSecondPairOfEyes: verified,
      issues,
      recommendation: verified
        ? 'Action verified: Math reconciles and tone complies with regulatory policy.'
        : `Action rejected by Verifier: Address issues: ${issues.join('; ')}`
    };
  }
}
