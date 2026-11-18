/**
 * AgentOS Mobile API Client: Bridges mobile UI actions directly to the agent engines.
 * Hardened with SEC-06: Server-Authoritative Approval Gateway to prevent client-side bypass.
 */

import crypto from 'node:crypto';
import { CashHoundAgent, Invoice } from '../../CashHound/src/index.js';
import { ResolveXAgent } from '../../ResolveX/src/index.js';
import { SentinelGovernor, PermissionScope } from '../../SentinelMesh/src/index.js';
import { LocalRoarAgent } from '../../LocalRoar/src/index.js';
import { PulseMDAgent, ClinicianAuth } from '../../PulseMD/src/index.js';
import { OmniLifeAgent } from '../../OmniLife/src/index.js';
import { AgentMemoryGraph, MemoryPrivacyTier } from './memory-graph.js';
import { AgentSelfHealer, FaultSignature } from './self-healer.js';
import { SpeculativeVerifier } from './speculative-verifier.js';

export class ServerApprovalGateway {
  constructor(sharedSecret = 'agent_os_mobile_gateway_secret_2026') {
    this.sharedSecret = sharedSecret;
    this.usedTokens = new Set();
  }

  generateApprovalTicket(agentName, actionId, amountCents = 0) {
    const nonce = crypto.randomBytes(12).toString('hex');
    const timestamp = Date.now();
    const payload = `${agentName}:${actionId}:${amountCents}:${timestamp}:${nonce}`;
    const hmac = crypto.createHmac('sha256', this.sharedSecret).update(payload).digest('hex');
    return `${payload}.${hmac}`;
  }

  verifyAndAuthorizeApproval(ticket, userRole = 'OPERATOR') {
    if (!ticket || typeof ticket !== 'string') {
      return { authorized: false, reason: 'Missing approval token' };
    }

    if (this.usedTokens.has(ticket)) {
      return { authorized: false, reason: 'Replay detected: approval token has already been consumed' };
    }

    const [payload, receivedHmac] = ticket.split('.');
    if (!payload || !receivedHmac) {
      return { authorized: false, reason: 'Malformed ticket structure' };
    }

    const expectedHmac = crypto.createHmac('sha256', this.sharedSecret).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac))) {
      return { authorized: false, reason: 'Invalid signature on approval ticket' };
    }

    const [agentName, actionId, amountStr, timestampStr] = payload.split(':');
    const timestamp = Number.parseInt(timestampStr, 10);

    // 10 minute token validity
    if (Date.now() - timestamp > 600000) {
      return { authorized: false, reason: 'Approval ticket expired' };
    }

    this.usedTokens.add(ticket);
    return {
      authorized: true,
      agentName,
      actionId,
      amountCents: Number.parseInt(amountStr, 10),
      userRole
    };
  }
}

export class MobileAgentHub {
  constructor() {
    this.cashhound = new CashHoundAgent();
    this.resolvex = new ResolveXAgent();
    this.sentinel = new SentinelGovernor();
    this.localroar = new LocalRoarAgent('Apex Services');
    this.pulsemd = new PulseMDAgent();
    this.omnilife = new OmniLifeAgent('Subash');
    this.gateway = new ServerApprovalGateway();
    this.memoryGraph = new AgentMemoryGraph();
    this.selfHealer = new AgentSelfHealer();
    this.verifier = new SpeculativeVerifier();

    // Setup Sentinel policies with safe bounds
    this.sentinel.registerAgent('cashhound-worker', [PermissionScope.READ_DATA, PermissionScope.CUSTOMER_COMMUNICATION], 100000);
    this.sentinel.registerAgent('resolvex-worker', [PermissionScope.READ_DATA, PermissionScope.FINANCIAL_TRANSACTION], 10000);
  }

  getGlobalMetrics() {
    return {
      revenueRecovered: '$14,250',
      activeAgents: 6,
      pendingApprovalsCount: 3,
      systemStatus: 'ALL_SYSTEMS_OPTIMAL'
    };
  }
}

export const mobileHub = new MobileAgentHub();
