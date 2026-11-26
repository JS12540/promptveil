import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { guard } from '../apps/cli/agents.ts';

const cli = fileURLToPath(new URL('../apps/cli/index.ts', import.meta.url));
function run(args: string[], input = '', env = process.env) {
  return spawnSync(process.execPath, ['--experimental-strip-types', cli, ...args], {
    input,
    env: { ...env, NODE_NO_WARNINGS: '1' },
    encoding: 'utf8',
  });
}

test('protect writes only approved text and fails closed on private or unsupported input', () => {
  const allowed = run(['protect'], 'Invest ₹25,000.');
  assert.equal(allowed.status, 0);
  assert.equal(allowed.stdout, 'Invest ₹25,000.');
  assert.equal(allowed.stderr, '');
  const blocked = run(['protect'], 'Password: never-valid-fixture');
  assert.equal(blocked.status, 2);
  assert.equal(blocked.stdout, '');
  assert.doesNotMatch(blocked.stderr, /never-valid-fixture/);
  const errored = run(['protect'], 'a'.repeat(65_537));
  assert.equal(errored.status, 3);
  assert.equal(errored.stdout, '');
  const redacted = run(['protect', '--redact'], 'Password: "synthetic phrase"');
  assert.equal(redacted.status, 0);
  assert.equal(redacted.stdout, 'Password: [PV_REDACTED]');
  const dotenv = run(['protect', '--dotenv'], 'CUSTOM_SETTING=fixture-value\n');
  assert.equal(dotenv.status, 0);
  assert.equal(dotenv.stdout, 'CUSTOM_SETTING=[PV_REDACTED]\n');
  const config = run(['protect', '--config'], '{"profile":{"custom":"fixture-value","active":true}}');
  assert.equal(config.status, 0);
  assert.deepEqual(JSON.parse(config.stdout), { profile: { custom: '[PV_REDACTED]', active: '[PV_REDACTED]' } });
});

test('scan --file returns only value-free findings', t => {
  const temp = mkdtempSync(join(tmpdir(), 'promptveil-scan-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const input = join(temp, 'fixture.txt');
  writeFileSync(input, 'Customer ID: 73918426');
  const result = run(['scan', '--file', input, '--json']);
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).findings[0].type, 'customer_id');
  assert.doesNotMatch(result.stdout, /73918426/);
});

test('both adapters block protected prompts without returning detected values', () => {
  const prompt = 'Customer ID: 73918426';
  for (const agent of ['claude-code', 'codex']) {
    assert.deepEqual(guard(agent, JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'Invest ₹25,000.' })), {});
    const result = guard(agent, JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt }));
    assert.equal('decision' in result && result.decision, 'block');
    assert.doesNotMatch(JSON.stringify(result), /73918426/);
    const invalid = guard(agent, '{');
    assert.equal('decision' in invalid && invalid.decision, 'block');
  }
});

test('installer previews, applies idempotently, and preserves unrelated hooks', { skip: process.platform === 'win32' }, t => {
  const temp = mkdtempSync(join(tmpdir(), 'promptveil-agent-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const config = join(temp, 'hooks.json');
  mkdirSync(join(temp, 'existing'));
  const existing = { description: 'synthetic config', hooks: {
    UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'local-existing-hook' }] }],
    Stop: [{ hooks: [{ type: 'command', command: 'local-stop-hook' }] }],
  } };
  writeFileSync(config, JSON.stringify(existing));
  const env = { ...process.env, CODEX_HOME: temp };
  assert.equal(run(['install', 'codex'], '', env).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(config, 'utf8')), existing);
  assert.equal(run(['install', 'codex', '--apply'], '', env).status, 0);
  assert.equal(run(['install', 'codex', '--apply'], '', env).status, 0);
  const afterInstall = JSON.parse(readFileSync(config, 'utf8'));
  assert.equal(afterInstall.hooks.UserPromptSubmit.length, 2);
  assert.deepEqual(afterInstall.hooks.UserPromptSubmit[0], existing.hooks.UserPromptSubmit[0]);
  assert.deepEqual(afterInstall.hooks.Stop, existing.hooks.Stop);
  assert.match(run(['doctor', 'codex'], '', env).stdout, /configured/i);
  assert.equal(run(['uninstall', 'codex', '--apply'], '', env).status, 0);
  assert.equal(run(['uninstall', 'codex', '--apply'], '', env).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(config, 'utf8')), existing);
});

test('installer leaves malformed config untouched', { skip: process.platform === 'win32' }, t => {
  const temp = mkdtempSync(join(tmpdir(), 'promptveil-invalid-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const config = join(temp, 'hooks.json');
  writeFileSync(config, '{ invalid');
  const env = { ...process.env, CODEX_HOME: temp };
  assert.equal(run(['install', 'codex', '--apply'], '', env).status, 3);
  assert.equal(readFileSync(config, 'utf8'), '{ invalid');
});

test('Cursor hook returns the native allow and deny responses without exposing prompt values', () => {
  assert.deepEqual(guard('cursor', JSON.stringify({ prompt: 'Invest ₹25,000.', attachments: [] })), { continue: true });
  const result = run(['hook', 'cursor'], JSON.stringify({ prompt: 'Customer ID: 12345678.', attachments: [] }));
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).continue, false);
  assert.doesNotMatch(result.stdout, /12345678/);
  assert.match(JSON.stringify(guard('cursor', '{')), /"continue":false/);
});

test('Cursor installer preserves existing array hooks and removes only its own entry', { skip: process.platform === 'win32' }, t => {
  const home = mkdtempSync(join(tmpdir(), 'promptveil-cursor-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, '.cursor'));
  const config = join(home, '.cursor', 'hooks.json');
  const original = { version: 1, hooks: { beforeSubmitPrompt: [{ command: './other-hook' }], stop: [{ command: './stop-hook' }] } };
  writeFileSync(config, JSON.stringify(original));
  const env = { ...process.env, HOME: home };
  assert.match(run(['install', 'cursor'], '', env).stdout, /Preview.*beforeSubmitPrompt/);
  assert.deepEqual(JSON.parse(readFileSync(config, 'utf8')), original);
  assert.equal(run(['install', 'cursor', '--apply'], '', env).status, 0);
  assert.match(run(['install', 'cursor', '--apply'], '', env).stdout, /No change required/);
  const installed = JSON.parse(readFileSync(config, 'utf8'));
  assert.deepEqual(installed.hooks.beforeSubmitPrompt[0], original.hooks.beforeSubmitPrompt[0]);
  assert.equal(installed.hooks.beforeSubmitPrompt[1].failClosed, true);
  assert.deepEqual(installed.hooks.stop, original.hooks.stop);
  assert.match(run(['doctor', 'cursor'], '', env).stdout, /configured/i);
  assert.equal(run(['uninstall', 'cursor', '--apply'], '', env).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(config, 'utf8')), original);
});

test('every installed adapter denies labeled credentials and PII before prompt submission', () => {
  for (const [agent, hook_event_name] of [['claude-code', 'UserPromptSubmit'], ['codex', 'UserPromptSubmit'], ['cursor', 'beforeSubmitPrompt'], ['gemini', 'BeforeAgent']]) {
    const event = (prompt: string) => JSON.stringify({ hook_event_name, prompt });
    assert.deepEqual(guard(agent, event('Invest ₹25,000.')), agent === 'cursor' ? { continue: true } : {});
    for (const prompt of ['ACME_CLIENT_SECRET=fixture-never-valid', 'Patient name: Noor Example']) {
      const result = guard(agent, event(prompt));
      if (agent === 'cursor') assert.ok('continue' in result && result.continue === false);
      else assert.ok('decision' in result && result.decision === (agent === 'gemini' ? 'deny' : 'block'));
      assert.doesNotMatch(JSON.stringify(result), /fixture-never-valid|Noor Example/);
    }
  }
});

test('Gemini installer preserves settings and executes the command using the BeforeAgent protocol', { skip: process.platform === 'win32' }, t => {
  const home = mkdtempSync(join(tmpdir(), 'promptveil-gemini-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  mkdirSync(join(home, '.gemini'));
  const config = join(home, '.gemini', 'settings.json');
  const original = { hooksConfig: { enabled: true }, hooks: { BeforeAgent: [{ hooks: [{ type: 'command', command: 'existing-hook' }] }] } };
  writeFileSync(config, JSON.stringify(original));
  const env = { ...process.env, GEMINI_CLI_HOME: home };
  assert.match(run(['install', 'gemini'], '', env).stdout, /Preview.*BeforeAgent/);
  assert.deepEqual(JSON.parse(readFileSync(config, 'utf8')), original);
  assert.equal(run(['install', 'gemini', '--apply'], '', env).status, 0);
  assert.match(run(['install', 'gemini', '--apply'], '', env).stdout, /No change required/);
  const installed = JSON.parse(readFileSync(config, 'utf8'));
  assert.deepEqual(installed.hooks.BeforeAgent[0], original.hooks.BeforeAgent[0]);
  const { command, timeout } = installed.hooks.BeforeAgent[1].hooks[0];
  assert.equal(timeout, 5000);
  const result = spawnSync('/bin/sh', ['-c', command], {
    input: JSON.stringify({ hook_event_name: 'BeforeAgent', prompt: 'ACME_API_KEY=fixture-never-valid' }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).decision, 'deny');
  assert.doesNotMatch(result.stdout, /fixture-never-valid/);
  assert.equal(run(['uninstall', 'gemini', '--apply'], '', env).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(config, 'utf8')), original);
});
