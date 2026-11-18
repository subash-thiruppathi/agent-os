/**
 * @spekra.in/agent-os
 * The Autonomous Multi-Agent Operating System & Swarm Runtime for Spekra.in
 *
 * Core Modules Exported:
 * - SpeculativeVerifier: Pre-flight math and tone compliance checks
 * - AgentMemoryGraph & MemoryPrivacyTier: Cross-agent graph with zero-trust privacy tiers
 * - AgentSelfHealer & FaultSignature: Autonomous backoff retries & rail switching
 * - SpekraTelemetryBridge: W3C OpenTelemetry trace generator & mirrored ledger
 * - AgentOSSwarm: Multi-agent pipeline orchestrator
 * - BiometricController: Mobile biometric authorization challenge generator
 * - VoiceCockpit: Ambient voice command interpreter and speech synthesizer
 * - SentinelGovernor & PermissionScope: Zero-trust RBAC and quarantine manager
 * - Domain Agents: CashHound, ResolveX, LocalRoar, PulseMD, OmniLife, Booker, Clerk, Sidekick
 */

// Mobile & Core Engine Primitives
export {
  SpeculativeVerifier,
  PROHIBITED_COLLECTION_PATTERNS
} from '../agent-os-mobile/src/speculative-verifier.js';

export {
  AgentMemoryGraph,
  MemoryPrivacyTier
} from '../agent-os-mobile/src/memory-graph.js';

export {
  AgentSelfHealer,
  FaultSignature
} from '../agent-os-mobile/src/self-healer.js';

export {
  SpekraTelemetryBridge
} from '../agent-os-mobile/src/spekra-bridge.js';

export {
  AgentOSSwarm
} from '../agent-os-mobile/src/swarm.js';

export {
  BiometricController
} from '../agent-os-mobile/src/biometric.js';

export {
  VoiceCockpit
} from '../agent-os-mobile/src/voice.js';

// Zero-Trust Mesh & Governance
export {
  SentinelGovernor,
  PermissionScope
} from '../SentinelMesh/src/index.js';

// Autonomous Domain Agents
export {
  CashHoundAgent,
  Invoice
} from '../CashHound/src/index.js';

export {
  ResolveXAgent
} from '../ResolveX/src/index.js';

export {
  LocalRoarAgent
} from '../LocalRoar/src/index.js';

export {
  PulseMDAgent
} from '../PulseMD/src/index.js';

export {
  OmniLifeAgent
} from '../OmniLife/src/index.js';

export {
  parseIntake,
  CalendarAdapter
} from '../Booker/src/index.js';

export {
  settlementAgent,
  SettlementReconciler
} from '../Clerk/src/index.js';

export {
  fieldAgent,
  EvidenceRegistry,
  reportSchema
} from '../Sidekick/src/index.js';
