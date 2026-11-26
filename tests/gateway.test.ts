import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { PassThrough, Readable } from 'node:stream';
import { test } from 'node:test';
import { createGateway, sanitizeRequest } from '../apps/gateway/index.ts';

const model = 'synthetic-model';
const customer = '73918426';
const credential = 'password: synthetic-never-valid';
const sample = {
  model,
  instructions: 'Summarize customer activity.',
  input: [
    { type: 'message', role: 'user', content: [{ type: 'input_text', text: `Customer ID: ${customer} paid ₹25,000.` }] },
    { type: 'function_call', id: 'fc_demo', call_id: 'call_demo', name: 'lookup', arguments: JSON.stringify({ notes: `Customer ID: ${customer}` }) },
    { type: 'function_call_output', call_id: 'call_demo', output: `Customer ID: ${customer}` },
  ],
  stream: true,
};

test('gateway protects model-bound messages and tool values without changing identifiers', () => {
  const sanitized = sanitizeRequest(sample) as typeof sample & { store: boolean };
  const rendered = JSON.stringify(sanitized);
  assert.doesNotMatch(rendered, new RegExp(customer));
  assert.match(rendered, /₹25,000/);
  assert.equal(sanitized.model, model);
  assert.equal(sanitized.store, false);
  assert.equal(sanitized.input[1].id, 'fc_demo');
  assert.equal(sanitized.input[1].call_id, 'call_demo');
  assert.equal(sanitized.input[2].call_id, 'call_demo');
  assert.equal(new Set(rendered.match(/\[PV_CUSTOMER_ID_[^\]]+\]/g)).size, 1);
});

test('gateway rejects credentials, malformed tool arguments and unsupported content', () => {
  assert.throws(() => sanitizeRequest({ model, input: credential }));
  assert.throws(() => sanitizeRequest({ model, input: [{ type: 'input_image', image_url: 'https://example.invalid/' }] }));
  assert.throws(() => sanitizeRequest({ model, input: 'safe', previous_response_id: 'synthetic' }));
  assert.throws(() => sanitizeRequest({ model, input: [{ ...sample.input[1], arguments: '{' }] }));
  assert.throws(() => sanitizeRequest({ model, input: [{ type: 'reasoning', encrypted_content: 'synthetic' }] }));
});

test('gateway forwards a redacted file-read result with tool identifiers intact', () => {
  const item = { ...sample.input[2], output: 'CUSTOM_SETTING=fixture-value\nexport AUTH_TOKEN="synthetic phrase"\nUseful file context' };
  const sanitized = sanitizeRequest({ model, input: [item] }) as { store: boolean; input: typeof item[] };
  assert.equal(sanitized.input[0].call_id, item.call_id);
  assert.equal(sanitized.input[0].output, 'CUSTOM_SETTING=[PV_REDACTED]\nexport AUTH_TOKEN=[PV_REDACTED]\nUseful file context');
  const structured = sanitizeRequest({
    model,
    input: [{ ...item, output: [{ type: 'input_text', text: 'CUSTOM_SETTING=fixture-value' }] }],
  });
  assert.match(JSON.stringify(structured), /"type":"input_text","text":"CUSTOM_SETTING=\[PV_REDACTED\]"/);
  const environment = sanitizeRequest({
    model,
    input: [{ ...item, output: JSON.stringify({ env: { CUSTOM: 'fixture-value', FEATURE: true }, summary: 'Read complete' }) }],
  }) as { store: boolean; input: { output: string }[] };
  assert.deepEqual(JSON.parse(environment.input[0].output), { env: { CUSTOM: '[PV_REDACTED]', FEATURE: '[PV_REDACTED]' }, summary: 'Read complete' });
});

test('gateway preserves structured argument keys while protecting the values they label', () => {
  const argumentsItem = { ...sample.input[1], arguments: JSON.stringify({ customer_id: customer, dateOfBirth: '1987-04-21' }) };
  const result = sanitizeRequest({ model, input: [argumentsItem] }) as { store: boolean; input: { arguments: string }[] };
  const args = JSON.parse(result.input[0].arguments);
  assert.match(args.customer_id, /^\[PV_CUSTOMER_ID_/);
  assert.match(args.dateOfBirth, /^\[PV_DATE_OF_BIRTH_/);
  assert.doesNotMatch(JSON.stringify(args), new RegExp(customer));
  assert.throws(() => sanitizeRequest({
    model,
    input: [{ ...argumentsItem, arguments: JSON.stringify({ ACME_CLIENT_SECRET: 'synthetic-value-only' }) }],
  }));
});

test('request handler streams only sanitized model-bound traffic without opening a socket', { timeout: 3000 }, async () => {
  const events = 'event: response.completed\ndata: {"type":"response.completed"}\n\n';
  const forwarded: string[] = [];
  const token = 'synthetic-handler-token';
  const server = createGateway({
    token,
    apiKey: 'synthetic-upstream-key',
    forward: async (_url, options) => {
      forwarded.push(String(options?.body));
      return new Response(events, { headers: { 'content-type': 'text/event-stream' } });
    },
  });

  async function send(payload: object | Uint8Array, { method = 'POST', url = '/v1/responses', headers = {} }: {
    method?: string; url?: string; headers?: Record<string, string>;
  } = {}) {
    const bytes = payload instanceof Uint8Array ? payload : Buffer.from(JSON.stringify(payload));
    const request = Object.assign(Readable.from([bytes]), {
      socket: { localPort: 8787 },
      headers: { 'content-type': 'application/json', host: '127.0.0.1:8787', authorization: `Bearer ${token}`, ...headers },
      method,
      url,
    });
    let status = 0;
    let body = '';
    const response = Object.assign(new PassThrough(), {
      headersSent: false,
      writeHead(code: number) {
        status = code;
        this.headersSent = true;
      },
    });
    response.setEncoding('utf8');
    response.on('data', chunk => { body += chunk; });
    const completed = once(response, 'finish');
    server.emit('request', request, response);
    await completed;
    return { status, body };
  }

  const denied = await send({ model, input: credential });
  assert.equal(denied.status, 422);
  assert.doesNotMatch(denied.body, /synthetic-never-valid/);
  assert.equal((await send(sample, { headers: { origin: 'https://fixture.invalid' } })).status, 403);
  assert.equal((await send(sample, { headers: { host: 'fixture.invalid:8787' } })).status, 403);
  assert.equal((await send(sample, { headers: { authorization: 'Bearer wrong-fixture' } })).status, 401);
  assert.equal((await send(sample, { method: 'GET' })).status, 404);
  assert.equal((await send(sample, { url: '/v1/unknown' })).status, 404);
  assert.equal((await send(sample, { headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await send(Uint8Array.of(0xff))).status, 422);
  assert.equal(forwarded.length, 0);
  assert.deepEqual(await send(sample), { status: 200, body: events });
  assert.equal(forwarded.length, 1);
  assert.doesNotMatch(forwarded[0], new RegExp(customer));
  const readOutput = { ...sample.input[2], output: 'CUSTOM_SETTING=fixture-value\nUseful file context' };
  assert.deepEqual(await send({ model, input: [readOutput] }), { status: 200, body: events });
  assert.equal(forwarded.length, 2);
  assert.doesNotMatch(forwarded[1], /fixture-value/);
  assert.match(forwarded[1], /CUSTOM_SETTING=\[PV_REDACTED\]/);
});

test('disconnect cancels the in-flight upstream request', { timeout: 3000 }, async () => {
  const token = 'synthetic-cancel-token';
  let started: (signal: AbortSignal) => void = () => {};
  const captured = new Promise<AbortSignal>(resolve => { started = resolve; });
  const server = createGateway({
    token,
    apiKey: 'synthetic-upstream-key',
    forward: async (_url, options) => {
      const signal = options?.signal;
      assert.ok(signal);
      started(signal);
      return new Promise<Response>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    },
  });
  const request = Object.assign(Readable.from([Buffer.from(JSON.stringify(sample))]), {
    socket: { localPort: 8787 },
    headers: { 'content-type': 'application/json', host: '127.0.0.1:8787', authorization: `Bearer ${token}` },
    method: 'POST',
    url: '/v1/responses',
  });
  const response = new PassThrough();
  server.emit('request', request, response);
  const signal = await captured;
  const closed = once(response, 'close');
  response.destroy();
  await closed;
  assert.equal(signal.aborted, true);
});

test('loopback gateway forwards approved SSE and keeps denied traffic local', async t => {
  const events = 'event: response.created\ndata: {"type":"response.created"}\n\nevent: response.completed\ndata: {"type":"response.completed"}\n\n';
  const requests: RequestInit[] = [];
  const token = 'synthetic-loopback-token';
  const server = createGateway({
    token,
    apiKey: 'synthetic-upstream-token',
    forward: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.ok(options);
      requests.push(options);
      return new Response(events, { headers: { 'content-type': 'text/event-stream' } });
    },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
  } catch (error) {
    if (process.env.CI !== 'true' && ['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      t.skip('Environment disallows binding loopback; CI requires this check.');
      return;
    }
    throw error;
  }
  t.after(() => { server.closeAllConnections(); server.close(); });
  const { port } = server.address() as AddressInfo;
  const target = `http://127.0.0.1:${port}/v1/responses`;
  const post = (payload: unknown, extra: Record<string, string> = {}) => fetch(target, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...extra },
    body: JSON.stringify(payload),
  });
  assert.equal((await post({ model, input: credential })).status, 422);
  assert.equal((await post(sample, { origin: 'https://example.invalid' })).status, 403);
  assert.equal((await post(sample, { authorization: 'Bearer incorrect' })).status, 401);
  assert.equal(requests.length, 0);
  const response = await post(sample);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  assert.equal(await response.text(), events);
  assert.equal(requests.length, 1);
  assert.doesNotMatch(String(requests[0].body), new RegExp(customer));
  assert.equal(new Headers(requests[0].headers).get('authorization'), 'Bearer synthetic-upstream-token');
});
