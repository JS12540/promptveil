import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderRelayProfile } from '../../adapters/codex/index.ts';
import { createGateway } from '../../apps/gateway/index.ts';

const codex = process.env.CODEX_BIN || 'codex';
const expectedVersion = '0.172.0';
const model = 'gpt-5.4';
const marker = '82469315';
const mockReply = 'PromptVeil synthetic relay verified.';
const token = randomBytes(32).toString('hex');
const temp = await mkdtemp(join(tmpdir(), 'promptveil-codex-'));
const appHome = join(temp, 'codex');
let requests = [];

const environment = {
  PATH: process.env.PATH,
  HOME: temp,
  CODEX_HOME: appHome,
  XDG_CACHE_HOME: join(temp, 'cache'),
  XDG_CONFIG_HOME: join(temp, 'config'),
  XDG_DATA_HOME: join(temp, 'data'),
  TMPDIR: tmpdir(),
  NO_PROXY: '127.0.0.1,localhost',
  PROMPTVEIL_GATEWAY_TOKEN: token,
};

function run(args, input = '') {
  const child = spawn(codex, args, {
    cwd: temp,
    env: environment,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 45_000,
    killSignal: 'SIGKILL',
  });
  const chunks = { stdout: '', stderr: '' };
  for (const stream of ['stdout', 'stderr']) {
    child[stream].setEncoding('utf8');
    child[stream].on('data', chunk => {
      if (chunks[stream].length < 60_000) chunks[stream] += chunk;
    });
  }
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  return once(child, 'close').then(([code, signal]) => ({ code, signal, ...chunks }));
}

function syntheticStream() {
  const item = {
    id: 'msg_promptveil_smoke',
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [{ type: 'output_text', text: mockReply, annotations: [] }],
  };
  const response = { id: 'resp_promptveil_smoke', model, output: [item], end_turn: true };
  const events = [
    { type: 'response.created', response: { id: response.id, model } },
    { type: 'response.output_item.added', output_index: 0, item: { ...item, content: [], status: 'in_progress' } },
    { type: 'response.output_text.delta', output_index: 0, item_id: item.id, content_index: 0, delta: mockReply },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response },
  ];
  return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

const gateway = createGateway({
  token,
  apiKey: 'synthetic-upstream-placeholder',
  async forward(url, init) {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(init.headers.authorization, 'Bearer synthetic-upstream-placeholder');
    requests.push(JSON.parse(init.body));
    return syntheticStream();
  },
});

try {
  await mkdir(appHome, { mode: 0o700 });
  const version = await run(['--version']);
  assert.equal(version.code, 0);
  assert.equal(version.stdout.trim(), `codex-cli ${expectedVersion}`);
  gateway.listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  const port = gateway.address().port;
  await writeFile(join(appHome, 'config.toml'), `
model = "${model}"
model_reasoning_effort = "none"
check_for_update_on_startup = false
approval_policy = "never"

${renderRelayProfile(port)}stream_idle_timeout_ms = 15000

[analytics]
enabled = false

[feedback]
enabled = false
`, { mode: 0o600 });
  const report = join(temp, 'reply.txt');
  const options = ['exec', '--ephemeral', '--ignore-rules', '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never'];
  const approved = await run([...options, '--output-last-message', report, '-'], `Customer ID: ${marker}. Invest ₹25,000. No tool calls are needed.`);
  assert.equal(approved.code, 0, approved.stderr);
  assert.equal((await readFile(report, 'utf8')).trim(), mockReply);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].store, false);
  const forwarded = JSON.stringify(requests[0]);
  assert.ok(forwarded.includes('[PV_CUSTOMER_ID_'));
  assert.ok(forwarded.includes('₹25,000'));
  assert.ok(!forwarded.includes(marker), 'Synthetic identifier reached the mock upstream');

  requests = [];
  const denied = await run([...options, '-'], 'password: synthetic-code-smoke-value');
  assert.equal(denied.signal, null);
  assert.notEqual(denied.code, 0);
  assert.match(denied.stderr + denied.stdout, /request_not_forwarded|422/);
  assert.equal(requests.length, 0);
  console.log(`Codex CLI ${expectedVersion} mock relay verified (mask, SSE response, denial before forwarding).`);
} finally {
  gateway.closeAllConnections();
  if (gateway.listening) {
    gateway.close();
    await once(gateway, 'close');
  }
  await rm(temp, { recursive: true, force: true });
}
