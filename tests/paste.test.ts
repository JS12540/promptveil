import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatPasteEditorSelectors } from '../apps/extension/providers.ts';
import { handleChatPaste } from '../apps/extension/paste.ts';

test('native paste cancels raw delivery and inserts only approved plain text', t => {
  class Element {
    isContentEditable = true;
    contentEditable = 'true';
    closest(selector: string) { return selector === '#prompt-textarea' || selector.startsWith('[contenteditable=') ? this : null; }
  }
  class Textarea extends Element {
    disabled = false;
    readOnly = false;
  }
  const descriptors = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, { HTMLElement: Element, HTMLTextAreaElement: Textarea });
  t.after(() => {
    for (const name of ['HTMLElement', 'HTMLTextAreaElement']) {
      if (descriptors[name]) Object.defineProperty(globalThis, name, descriptors[name]);
      else Reflect.deleteProperty(globalThis, name);
    }
  });

  function paste(text: string, { trusted = true, selectors = ['#prompt-textarea'], types = ['text/plain', 'text/html'], accepts = true } = {}) {
    const calls: string[] = [];
    const inserted: string[] = [];
    const notices: string[] = [];
    const event = {
      isTrusted: trusted,
      cancelable: true,
      defaultPrevented: false,
      composedPath: () => [new Element()],
      preventDefault: () => calls.push('cancel'),
      stopImmediatePropagation: () => calls.push('stop'),
      clipboardData: {
        types,
        getData: (type: string) => {
          assert.equal(type, 'text/plain');
          calls.push('read');
          return text;
        },
      },
    };
    handleChatPaste(event as unknown as ClipboardEvent, selectors, approved => {
      calls.push('insert');
      inserted.push(approved);
      return accepts;
    }, notice => notices.push(notice));
    return { calls, inserted, notices };
  }

  const protectedPaste = paste('Customer ID: 12345678. Invest ₹25,000.');
  assert.deepEqual(protectedPaste.calls, ['cancel', 'stop', 'read', 'insert']);
  assert.match(protectedPaste.inserted[0], /PV_CUSTOMER_ID_.*₹25,000/);
  assert.doesNotMatch(protectedPaste.inserted[0], /12345678/);
  assert.deepEqual(paste('Invest ₹25,000.').inserted, ['Invest ₹25,000.']);

  for (const [text, message] of [
    ['Password: never-valid-fixture', /blocked/],
    ['IFSC: TEST0123456', /review/],
    ['a'.repeat(65_537), /could not scan/],
    ['', /Paste plain text/],
  ] as const) {
    const denied = paste(text);
    assert.deepEqual(denied.calls, ['cancel', 'stop', 'read']);
    assert.deepEqual(denied.inserted, []);
    assert.match(denied.notices[0], message);
  }
  assert.deepEqual(paste('ordinary', { trusted: false }).calls, []);
  assert.deepEqual(paste('ordinary', { selectors: ['#unrelated'] }).calls, []);
  assert.deepEqual(paste('', { types: ['Files'] }).calls, []);
  assert.match(paste('ordinary', { accepts: false }).notices[0], /could not accept/);
});


test('native paste scoping excludes generic forms and unsupported sites', () => {
  const selectors = chatPasteEditorSelectors('https://chatgpt.com/');
  assert.ok(selectors.some(selector => selector.startsWith('#prompt-textarea')));
  assert.ok(selectors.every(selector => !selector.includes('main textarea')));
  assert.deepEqual(chatPasteEditorSelectors('https://chatgpt.com.invalid/'), []);
});
