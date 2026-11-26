import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSendPause, scanPausePortName, waitForSendPause } from '../apps/extension/scan-pause.ts';
import type { ChatScanPort } from '../apps/extension/scan-pause.ts';
import { guardChatSend } from '../apps/extension/send.ts';

function portPair() {
  type Handler = (message: unknown) => void;
  const messages: Handler[][] = [[], []];
  const disconnects: (() => void)[][] = [[], []];
  let live = true;
  return [0, 1].map(index => ({
    name: scanPausePortName,
    onMessage: { addListener(listener: Handler) { messages[index].push(listener); } },
    onDisconnect: { addListener(listener: () => void) { disconnects[index].push(listener); } },
    postMessage(message: unknown) { if (live) messages[1 - index].forEach(listener => listener(message)); },
    disconnect() {
      if (!live) return;
      live = false;
      disconnects[1 - index].forEach(listener => listener());
    },
  })) as [ChatScanPort, ChatScanPort];
}

test('the first acknowledgement holds Send, and overlapping scans release independently', async () => {
  const tab = createSendPause();
  const first = portPair();
  const second = portPair();
  const firstScan = new AbortController();
  const secondScan = new AbortController();
  const firstAck = waitForSendPause(first[0], firstScan.signal);
  const secondAck = waitForSendPause(second[0], secondScan.signal);
  assert.equal(tab.active, false);
  tab.attach(first[1]);
  assert.equal((await firstAck)(), true);
  tab.attach(second[1]);
  const secondStillPaused = await secondAck;
  assert.equal(tab.active, true);

  const event = { isTrusted: true, cancelable: true, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() {},
  };
  guardChatSend(event as unknown as Event, () => assert.fail('Draft was read during the pause'),
    () => assert.fail('Draft was replaced during the pause'), message => assert.match(message, /checking/), tab.active);
  assert.equal(event.defaultPrevented, true);

  firstScan.abort();
  assert.equal(tab.active, true);
  secondScan.abort();
  assert.equal(secondStillPaused(), false);
  assert.equal(tab.active, false);
});

test('canceling before acknowledgement and a closed chat both reject the pending scan', async () => {
  const [outgoing, incoming] = portPair();
  const scan = new AbortController();
  const acknowledgement = waitForSendPause(outgoing, scan.signal);
  scan.abort();
  await assert.rejects(acknowledgement, /connected/);

  const [nextOutgoing, nextIncoming] = portPair();
  const nextScan = new AbortController();
  const nextAck = waitForSendPause(nextOutgoing, nextScan.signal);
  nextIncoming.disconnect();
  await assert.rejects(nextAck, /connected/);

  const tab = createSendPause();
  tab.attach({ ...incoming, postMessage() { throw new Error('closed port'); } });
  assert.equal(tab.active, false);
});
