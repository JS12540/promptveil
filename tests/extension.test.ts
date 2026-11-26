import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { insertIntoFocusedEditor } from '../apps/extension/insert.ts';
import { chatEditorSelectors, chatOrigins, findChatProvider } from '../apps/extension/providers.ts';
import { protect } from '../packages/core/index.ts';

const url = 'https://provider.fixture.invalid/chat';
const sample = 'Customer ID: 12345678. Invest ₹25,000.';
const source = '(' + insertIntoFocusedEditor.toString() + ')(approved, expectedUrl)';

test('the serialized extension transfer targets a focused editor on the expected page', () => {
  const result = protect(sample);
  assert.equal(result.status, 'ok');
  class Element {}
  class Textarea extends Element {
    disabled = false;
    readOnly = false;
    received = '';
    events: Event[] = [];
    set value(value: string) { this.received = value; }
    dispatchEvent(event: Event) { this.events.push(event); }
  }
  const field = new Textarea();
  const context = {
    location: { href: url },
    document: { activeElement: field },
    HTMLElement: Element,
    HTMLTextAreaElement: Textarea,
    Event,
    approved: result.sanitizedText,
    expectedUrl: url,
  };
  assert.equal(runInNewContext(source, { ...context, expectedUrl: url + '/changed' }), false);
  assert.equal(field.received, '');
  assert.equal(runInNewContext(source, context), true);
  assert.equal(field.received, result.sanitizedText);
  assert.doesNotMatch(field.received, /12345678/);
  assert.match(field.received, /₹25,000/);
  assert.deepEqual(field.events.map(event => [event.type, event.bubbles]), [['input', true]]);
  field.readOnly = true;
  assert.equal(runInNewContext(source, context), false);
});

test('rich-text transfer focuses the editing host and forwards only approved text', () => {
  const calls: unknown[][] = [];
  class Element {
    isContentEditable = true;
    closest() { return { focus: () => calls.push(['focus']) }; }
  }
  class Textarea extends Element {}
  const activeElement = new Element();
  const context = {
    location: { href: url },
    document: {
      activeElement,
      execCommand: (...args: unknown[]) => { calls.push(args); return true; },
    },
    HTMLElement: Element,
    HTMLTextAreaElement: Textarea,
    approved: 'Customer ID: [protected]. Invest ₹25,000.',
    expectedUrl: url,
  };
  assert.equal(runInNewContext(source, context), true);
  assert.deepEqual(calls, [['focus'], ['insertText', false, context.approved]]);
});

test('provider mode uses the visible ChatGPT editor without replacing an unrelated draft', () => {
  class Element {}
  const events: string[] = [];
  class Textarea extends Element {
    disabled = false;
    readOnly = false;
    #text = '';
    getClientRects() { return [true]; }
    checkVisibility() { return true; }
    get value() { return this.#text; }
    set value(value: string) { this.#text = value; }
    dispatchEvent(event: Event) { events.push(event.type); }
  }
  const field = new Textarea();
  const chatUrl = 'https://chatgpt.com/';
  const context = {
    location: { href: chatUrl, hostname: 'chatgpt.com' },
    document: {
      activeElement: new Element(),
      querySelectorAll(selector: string) {
        assert.match(selector, /^#prompt-textarea/);
        return [field];
      },
    },
    HTMLElement: Element,
    HTMLTextAreaElement: Textarea,
    Event,
    approved: 'Customer ID: [protected]. Invest ₹25,000.',
    expectedUrl: chatUrl,
    selectors: chatEditorSelectors(chatUrl),
    previousDraft: '',
  };
  const providerSource = '(' + insertIntoFocusedEditor.toString() + ')(approved, expectedUrl, selectors, previousDraft)';
  field.value = 'A draft entered directly into ChatGPT';
  assert.equal(runInNewContext(providerSource, context), false);
  assert.equal(events.length, 0);
  field.value = '';
  assert.equal(runInNewContext(providerSource, context), true);
  assert.equal(field.value, context.approved);
  assert.equal(runInNewContext(providerSource, { ...context, approved: 'Updated protected draft', previousDraft: context.approved }), true);
  assert.equal(field.value, 'Updated protected draft');
  assert.equal(runInNewContext(providerSource, { ...context, location: { href: 'https://other.invalid/' } }), false);
  assert.deepEqual(events, ['input', 'input']);
});

test('the provider registry covers exact chat origins and rejects lookalike sites', () => {
  const supported = [
    'https://chatgpt.com', 'https://claude.ai', 'https://gemini.google.com',
    'https://grok.com', 'https://chat.deepseek.com', 'https://www.perplexity.ai',
    'https://perplexity.ai', 'https://copilot.com', 'https://copilot.microsoft.com',
    'https://chat.mistral.ai', 'https://poe.com', 'https://chat.qwen.ai',
  ];
  assert.deepEqual(chatOrigins, supported);
  for (const origin of supported) {
    const provider = findChatProvider(origin + '/c/synthetic');
    assert.ok(provider);
    assert.ok(chatEditorSelectors(origin + '/c/synthetic').includes(provider.editors[0]));
    assert.equal(findChatProvider(origin + '.invalid/c/synthetic'), undefined);
  }
  assert.deepEqual(chatEditorSelectors('https://other.invalid/'), []);
  assert.equal(findChatProvider('http://grok.com/'), undefined);
  assert.equal(findChatProvider('https://grok.com@other.invalid/'), undefined);
});

test('integrated transfer declines ambiguous editors and the toolbar falls back to a focused editor', () => {
  class Element {}
  class Textarea extends Element {
    disabled = false;
    readOnly = false;
    #text = '';
    getClientRects() { return [true]; }
    checkVisibility() { return true; }
    get value() { return this.#text; }
    set value(value: string) { this.#text = value; }
    dispatchEvent() {}
  }
  const left = new Textarea();
  const right = new Textarea();
  const context = {
    location: { href: url },
    document: { activeElement: null as Textarea | null, querySelectorAll: () => [left, right] },
    HTMLElement: Element,
    HTMLTextAreaElement: Textarea,
    Event,
    approved: 'Protected text',
    expectedUrl: url,
    selectors: ['textarea'],
    previousDraft: '',
  };
  const transfer = '(' + insertIntoFocusedEditor.toString() + ')(approved, expectedUrl, selectors, previousDraft)';
  assert.equal(runInNewContext(transfer, context), false);
  assert.equal(left.value + right.value, '');
  context.document.activeElement = right;
  assert.equal(runInNewContext(transfer, { ...context, selectors: [] }), true);
  assert.equal(right.value, context.approved);
  assert.equal(left.value, '');
  right.value = 'Unrelated page draft';
  assert.equal(runInNewContext(transfer, { ...context, selectors: [] }), false);
  assert.equal(right.value, 'Unrelated page draft');
});
