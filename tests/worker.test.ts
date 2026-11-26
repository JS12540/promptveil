import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Result } from '../packages/contracts/index.ts';

type WorkerReply = Result | { restored: string };
type WorkerInput = { text?: string; restore?: string; clear?: boolean; redact?: boolean; config?: boolean };

test('worker restores a session token only when explicitly requested and clears its mappings', async t => {
  const replies: WorkerReply[] = [];
  const fakeWorker: {
    postMessage(message: WorkerReply): void;
    onmessage?: (event: MessageEvent<WorkerInput>) => void;
  } = {
    postMessage(message) { replies.push(message); },
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'self');
  Object.defineProperty(globalThis, 'self', { value: fakeWorker, configurable: true });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'self', previous);
    else Reflect.deleteProperty(globalThis, 'self');
  });
  await import('../packages/ui/worker.ts');
  const send = (data: WorkerInput) => fakeWorker.onmessage?.(new MessageEvent('message', { data }));
  const original = 'Customer ID: 69148327. Amount ₹25,000.';
  send({ text: original });
  const result = replies.at(-1);
  assert.ok(result && 'status' in result && result.status === 'ok');
  assert.doesNotMatch(JSON.stringify(result), /69148327/);
  assert.match(result.sanitizedText, /₹25,000/);

  send({ restore: result.sanitizedText });
  assert.deepEqual(replies.at(-1), { restored: original });
  send({ clear: true });
  send({ restore: result.sanitizedText });
  assert.deepEqual(replies.at(-1), { restored: result.sanitizedText });

  send({ text: 'CUSTOM_SETTING=fixture-value\nPassword: "synthetic phrase"', redact: true, config: true });
  const redacted = replies.at(-1);
  assert.ok(redacted && 'status' in redacted && redacted.status === 'ok');
  assert.equal(redacted.sanitizedText, 'CUSTOM_SETTING=[PV_REDACTED]\nPassword: [PV_REDACTED]');
  send({ restore: redacted.sanitizedText });
  assert.deepEqual(replies.at(-1), { restored: redacted.sanitizedText });
});
