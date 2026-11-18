import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentOSSwarm } from '../src/swarm.js';
import { BiometricController } from '../src/biometric.js';
import { VoiceCockpit } from '../src/voice.js';
import { mobileHub } from '../src/api.js';

test('AgentOS Swarm: executes full lifecycle LocalRoar -> Booker -> Sidekick -> Clerk -> SentinelMesh', async () => {
  const swarm = new AgentOSSwarm();
  const inquiry = `Customer: Rajesh Kumar
Address: 42 Palm Grove Road, Bangalore
Appliance: washing-machine
Slot: 2026-12-01T10:00:00+05:30
Estimated charge: ₹1,500
Technician: tech-101`;

  const result = await swarm.runFullServiceSwarm({ customerText: inquiry });
  assert.equal(result.status, 'SWARM_PIPELINE_COMPLETE');
  assert.equal(result.totalStepsExecuted, 5);
  assert.equal(result.pipelineLog[0].agent, 'LocalRoar');
  assert.equal(result.pipelineLog[1].agent, 'Booker');
  assert.equal(result.pipelineLog[2].agent, 'Sidekick');
  assert.equal(result.pipelineLog[3].agent, 'Clerk');
  assert.equal(result.pipelineLog[4].agent, 'SentinelMesh');
});

test('AgentOS Biometric Controller: generates challenge and verifies FaceID proof', () => {
  const bio = new BiometricController();
  const challenge = bio.generateBiometricChallenge('refund-act-101', 35000);

  assert.ok(challenge.promptText.includes('$350.00'));

  const proof = bio.verifyBiometricProof(challenge, true);
  assert.equal(proof.success, true);
  assert.equal(proof.authMethod, 'BIOMETRIC_FACE_ID_HARDWARE_BACKED');
  assert.ok(proof.hardwareSignature.length > 20);

  const failedProof = bio.verifyBiometricProof(challenge, false);
  assert.equal(failedProof.success, false);
});

test('AgentOS Voice Cockpit: interprets spoken commands and executes agent actions', () => {
  const voice = new VoiceCockpit(mobileHub);

  // Status check
  const statusReply = voice.interpretVoiceCommand('AgentOS, give me fleet status and health');
  assert.equal(statusReply.recognized, true);
  assert.ok(statusReply.spokenReply.includes('autonomous agents are online'));

  // Kill switch voice trigger
  const killReply = voice.interpretVoiceCommand('Emergency freeze all agent tools now');
  assert.equal(killReply.intent, 'EMERGENCY_KILL_SWITCH');
  assert.ok(killReply.spokenReply.includes('kill-switch engaged'));
});
