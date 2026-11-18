/**
 * Sidekick: Field Job Completion Agent
 * Guides the technician through on-site checklists, media capture, and customer acknowledgement.
 */
export const fieldAgent = {
  name: 'sidekick',
  next(job) {
    if (!job.report) return { wait: 'in_progress', reason: 'Technician report required' };
    if (job.report.checklistComplete !== true || job.report.customerAcknowledged !== true || !job.evidence || !job.evidence.length) {
      return { wait: 'evidence_review', reason: 'Require completed checklist, customer acknowledgement, and evidence reference' };
    }
    if (job.report.unresolved) return { wait: 'blocked', reason: 'Technician must resolve or assign follow-up before settlement' };
    return { transition: 'settlement' };
  }
};
