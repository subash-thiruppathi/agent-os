import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, '../bin/agentos.js');

function runCli(args = []) {
  return new Promise((resolve) => {
    execFile(process.execPath, [cliPath, ...args], (error, stdout, stderr) => {
      resolve({
        code: error ? error.code || 1 : 0,
        stdout,
        stderr
      });
    });
  });
}

test('CLI: agentos --help outputs command documentation', async () => {
  const { code, stdout } = await runCli(['--help']);
  assert.equal(code, 0);
  assert.ok(stdout.includes('AgentOS Developer CLI'));
  assert.ok(stdout.includes('doctor'));
  assert.ok(stdout.includes('fleet status'));
});

test('CLI: agentos doctor passes all 6 core health checks', async () => {
  const { code, stdout } = await runCli(['doctor']);
  assert.equal(code, 0);
  assert.ok(stdout.includes('All 6 Core Systems PASSED'));
  assert.ok(stdout.includes('MemoryGraph HIPAA Privacy Isolation'));
  assert.ok(stdout.includes('SpeculativeVerifier Math & FDCPA Tone Guard'));
  assert.ok(stdout.includes('AgentOSLLMGateway & Gemini Engine'));
});

test('CLI: agentos ai status tests LLM gateway and speculative guardrail', async () => {
  const { code, stdout } = await runCli(['ai']);
  assert.equal(code, 0);
  assert.ok(stdout.includes('AgentOS LLM Gateway & Gemini Engine Status'));
  assert.ok(stdout.includes('gemini-3.5-flash'));
  assert.ok(stdout.includes('PASSED'));
});

test('CLI: agentos fleet status renders active table', async () => {
  const { code, stdout } = await runCli(['fleet']);
  assert.equal(code, 0);
  assert.ok(stdout.includes('CashHound'));
  assert.ok(stdout.includes('ResolveX'));
  assert.ok(stdout.includes('SentinelMesh'));
});

test('CLI: agentos swarm runs full 5-stage pipeline', async () => {
  const { code, stdout } = await runCli(['swarm']);
  assert.equal(code, 0);
  assert.ok(stdout.includes('LocalRoar'));
  assert.ok(stdout.includes('SentinelMesh'));
  assert.ok(stdout.includes('Pipeline Completed'));
});

test('CLI: agentos audit verifies SHA-256 block ledger', async () => {
  const { code, stdout } = await runCli(['audit']);
  assert.equal(code, 0);
  assert.ok(stdout.includes('SHA-256 blocks verified'));
  assert.ok(stdout.includes('100% intact'));
});
