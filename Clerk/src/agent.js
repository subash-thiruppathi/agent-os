/**
 * Clerk: Settlement and Warranty Agent
 * Resolves financial work, reconciles estimate against final charges, issues invoices or prepares warranty claims.
 */
export const settlementAgent = {
  name: 'clerk',
  next(job) {
    if (job.report.amount !== job.input.amount) {
      return { wait: 'blocked', reason: 'Report charges differ from accepted estimate; revise and reauthorize the estimate' };
    }
    if (job.report.warranty) {
      if (!job.claim) return { tool: 'claim', permission: 'claim', reason: 'Prepare a simulated warranty case from the validated report' };
      return { tool: 'verifyClaim', reason: 'Check case resolution evidence' };
    }
    if (!job.invoice) return { tool: 'invoice', permission: 'invoice', reason: 'Issue a simulated invoice for the accepted amount' };
    return { tool: 'verifyPayment', reason: 'Verify payment against invoice amount' };
  }
};
