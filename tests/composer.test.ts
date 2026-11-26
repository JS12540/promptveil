import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mountComposer } from '../packages/ui/composer.ts';
import { protect } from '../packages/core/index.ts';

test('integrated composer scans and transfers approved output in one action, and blocks credentials locally', async t => {
  interface Control {
    value: string;
    disabled: boolean;
    hidden: boolean;
    textContent: string;
    onclick?: () => Promise<void>;
    onkeydown?: (event: Partial<KeyboardEvent>) => void;
    replaceChildren(): void;
  }

  const controls: Record<string, Control> = Object.fromEntries(
    ['input', 'output', 'strict', 'scan', 'copy', 'insert', 'status', 'review', 'restore', 'restore-button', 'clear']
      .map(id => [id, { value: '', disabled: false, hidden: false, textContent: '', replaceChildren() {} }]),
  );
  let completion: Promise<void> | undefined;
  class ScanWorker {
    onmessage?: (message: { data: ReturnType<typeof protect> }) => Promise<void>;
    postMessage({ text }: { text: string }) { completion = this.onmessage?.({ data: protect(text) }); }
    terminate() {}
  }
  const descriptors = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, {
    document: { getElementById: (id: string) => controls[id], querySelector: () => null },
    window: { setTimeout },
    Worker: ScanWorker,
  });
  t.after(() => {
    for (const name of ['document', 'window', 'Worker']) {
      if (descriptors[name]) Object.defineProperty(globalThis, name, descriptors[name]);
      else Reflect.deleteProperty(globalThis, name);
    }
  });

  const inserts: string[] = [];
  let paused = false;
  let acknowledge!: () => void;
  let finishInsert!: () => void;
  const inserted = new Promise<void>(resolve => { finishInsert = resolve; });
  mountComposer({
    transferOnScan: true,
    pauseSend: signal => new Promise(resolve => {
      paused = true;
      signal.addEventListener('abort', () => { paused = false; }, { once: true });
      acknowledge = () => resolve(() => paused);
    }),
    insert: async text => {
      assert.equal(paused, true);
      inserts.push(text);
      await inserted;
      return true;
    },
  });
  assert.equal(controls.scan.textContent, 'Protect and insert');
  assert.equal(controls.copy.hidden, true);
  assert.equal(controls.insert.hidden, true);

  controls.input.value = 'Customer ID: 12345678. Invest ₹25,000.';
  const firstScan = controls.scan.onclick?.();
  assert.equal(completion, undefined);
  let enterBlocked = false;
  controls.input.onkeydown?.({
    key: 'Enter',
    preventDefault() { enterBlocked = true; },
    stopImmediatePropagation() {},
  });
  assert.equal(enterBlocked, true);
  assert.equal(inserts.length, 0);
  acknowledge();
  await firstScan;
  assert.equal(paused, true);
  finishInsert();
  await completion;
  assert.equal(paused, false);
  assert.equal(inserts.length, 1);
  assert.doesNotMatch(inserts[0], /12345678/);
  assert.match(inserts[0], /₹25,000/);
  assert.match(controls.status.textContent, /Draft inserted/);

  controls.input.value = 'Password: never-valid-fixture';
  const secondScan = controls.scan.onclick?.();
  acknowledge();
  await secondScan;
  await completion;
  assert.equal(paused, false);
  assert.equal(inserts.length, 1);
  assert.equal(controls.output.value, '');
  assert.match(controls.status.textContent, /blocked/i);
});
