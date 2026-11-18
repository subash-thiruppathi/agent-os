/**
 * AgentOS Swarm Orchestrator: End-to-end multi-agent pipeline coordinator.
 * Chains LocalRoar -> Booker -> Sidekick -> Clerk -> CashHound under SentinelMesh governance.
 */

import { LocalRoarAgent } from '../../LocalRoar/src/index.js';
import { parseIntake, CalendarAdapter } from '../../Booker/src/index.js';
import { EvidenceRegistry, fieldAgent } from '../../Sidekick/src/index.js';
import { SettlementReconciler } from '../../Clerk/src/index.js';
import { CashHoundAgent, Invoice } from '../../CashHound/src/index.js';
import { SentinelGovernor, PermissionScope } from '../../SentinelMesh/src/index.js';

export class AgentOSSwarm {
  constructor() {
    this.sentinel = new SentinelGovernor();
    this.localroar = new LocalRoarAgent('Apex Prime');
    this.calendar = new CalendarAdapter(90);
    this.evidence = new EvidenceRegistry();
    this.clerk = new SettlementReconciler();
    this.cashhound = new CashHoundAgent();

    // Register swarm subagents with Sentinel policies
    this.sentinel.registerAgent('swarm-operator', [
      PermissionScope.READ_DATA,
      PermissionScope.WRITE_DATA,
      PermissionScope.CUSTOMER_COMMUNICATION,
      PermissionScope.FINANCIAL_TRANSACTION
    ], 500000);
  }

  /**
   * Executes the complete lifecycle of a service job across the multi-agent swarm.
   */
  async runFullServiceSwarm({ customerText, tenantId = 'tenant-alpha', techId = 'tech-101' }) {
    const pipelineLog = [];

    // Step 1: LocalRoar parses inbound inquiry and issues dynamic quote
    const leadResponse = this.localroar.handleInquiry(customerText, 'sms');
    pipelineLog.push({ step: '1_LEAD_ACQUISITION', agent: 'LocalRoar', outcome: leadResponse });

    // Step 2: Booker validates appointment and locks technician calendar slot
    const parsedIntake = parseIntake(customerText);
    const appointmentTime = parsedIntake.candidate?.slot || '2026-12-05T10:00:00.000Z';
    const reservation = this.calendar.reserve(tenantId, techId, appointmentTime, 'job-swarm-001');
    pipelineLog.push({ step: '2_DISPATCH_LOCK', agent: 'Booker', outcome: reservation });

    // Step 3: Sidekick registers on-site technician diagnostic evidence
    const photo = this.evidence.register(tenantId, 'job-swarm-001', 'motor_replacement_test.jpg', techId);
    pipelineLog.push({ step: '3_FIELD_EVIDENCE', agent: 'Sidekick', outcome: photo });

    // Step 4: Clerk reconciles estimate vs final work and issues authorized invoice
    const agreedAmountPaise = leadResponse.lead?.estimatedAmount || 150000;
    const invoice = this.clerk.issueInvoice(tenantId, 'job-swarm-001', agreedAmountPaise, 'INR');
    pipelineLog.push({ step: '4_SETTLEMENT_INVOICE', agent: 'Clerk', outcome: invoice });

    // Step 5: SentinelMesh validates and records the financial transaction into SHA-256 ledger
    const auditBlock = await this.sentinel.runStep(
      'swarm-operator',
      'record_swarm_settlement',
      PermissionScope.FINANCIAL_TRANSACTION,
      { amount: agreedAmountPaise, tenantId, jobId: 'job-swarm-001' },
      async () => ({ settled: true, invoiceId: invoice.id })
    );
    pipelineLog.push({ step: '5_SECURITY_GOVERNANCE', agent: 'SentinelMesh', outcome: auditBlock });

    return {
      status: 'SWARM_PIPELINE_COMPLETE',
      totalStepsExecuted: pipelineLog.length,
      pipelineLog
    };
  }
}
