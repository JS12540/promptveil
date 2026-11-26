import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const agents = process.argv.slice(2);
assert.ok(agents.length && agents.every(agent => ['claude-code', 'codex'].includes(agent)), 'Pass claude-code, codex, or both.');
const temp = mkdtempSync(join(tmpdir(), 'promptveil-native-'));
const cli = resolve('apps/cli/index.ts');
const prompt = 'Customer ID: 12345678.';
const codexHome = join(temp, 'codex');
const env = {
  PATH: process.env.PATH,
  HOME: temp,
  CODEX_HOME: codexHome,
  CLAUDE_CONFIG_DIR: join(temp, '.claude'),
  PROMPTVEIL_PORT: '65535',
  PROMPTVEIL_GATEWAY_TOKEN: 'synthetic-test-placeholder',
  ANTHROPIC_API_KEY: 'synthetic-test-placeholder',
  ANTHROPIC_BASE_URL: 'http://127.0.0.1:9',
  DISABLE_TELEMETRY: '1',
  DISABLE_ERROR_REPORTING: '1',
  DISABLE_AUTOUPDATER: '1',
  NO_PROXY: '127.0.0.1,localhost',
  CI: '1',
};
const run = (command, args, input) => {
  const result = spawnSync(command, args, {
    cwd: temp, env, input, encoding: 'utf8', timeout: 12_000, killSignal: 'SIGKILL',
  });
  if (result.error) throw result.error;
  return { status: result.status, text: result.stdout + result.stderr };
};

try {
  if (agents.includes('codex')) {
    mkdirSync(codexHome, { mode: 0o700 });
    const profile = run(process.execPath, [cli, 'profile', 'codex']);
    assert.equal(profile.status, 0);
    writeFileSync(join(codexHome, 'config.toml'), 'model = "gpt-5.4"\ncheck_for_update_on_startup = false\n' + profile.text, { mode: 0o600 });
  }
  for (const agent of agents) {
    assert.equal(run(process.execPath, [cli, 'install', agent, '--apply']).status, 0);
    const observed = agent === 'claude-code'
      ? run(process.env.CLAUDE_BIN || 'claude', ['--print', '--no-session-persistence', '--setting-sources', 'user', '--', prompt])
      // This scratch config contains only the hook installed and vetted by this test.
      : run(process.env.CODEX_BIN || 'codex', ['exec', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--dangerously-bypass-hook-trust', '-'], prompt);
    assert.match(observed.text, agent === 'claude-code' ? /UserPromptSubmit operation blocked by hook/ : /UserPromptSubmit Blocked/);
    console.log(`${agent}: real isolated CLI reported UserPromptSubmit blocking.`);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
