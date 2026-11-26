import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guardChatSend } from '../apps/extension/send.ts';

function attempt(text: string, { accepts = true, trusted = true, type = 'keydown', readError = false } = {}) {
  const calls: string[] = [];
  const notices: string[] = [];
  let draft = text;
  const event = {
    isTrusted: trusted,
    type,
    cancelable: true,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; calls.push('cancel'); },
    stopImmediatePropagation() { calls.push('stop'); },
  };
  guardChatSend(event as unknown as Event, () => {
    if (readError) throw new Error('Test editor read failure.');
    return draft;
  }, approved => {
    calls.push('replace');
    if (accepts) draft = approved;
    return accepts;
  }, notice => notices.push(notice));
  return { calls, notices, draft, canceled: event.defaultPrevented };
}

test('send guard passes clean text in the current event and masks a flagged draft before requiring another action', () => {
  assert.deepEqual(attempt('Invest ₹25,000.').calls, []);
  const first = attempt('Customer ID: 12345678. Invest ₹25,000.');
  assert.deepEqual(first.calls, ['cancel', 'stop', 'replace']);
  assert.equal(first.canceled, true);
  assert.doesNotMatch(first.draft, /12345678/);
  assert.match(first.draft, /PV_CUSTOMER_ID_.*₹25,000/);
  assert.match(first.notices[0], /Send again/);
  assert.equal(attempt(first.draft).canceled, false);
});

test('send guard blocks credentials, unresolved review, and failures without forwarding the draft', () => {
  for (const text of ['Password: never-valid-fixture', 'IFSC: TEST0123456', 'a'.repeat(65_537)]) {
    const result = attempt(text);
    assert.deepEqual(result.calls, ['cancel', 'stop']);
    assert.equal(result.canceled, true);
    assert.equal(result.draft, text);
  }
  assert.equal(attempt('Customer ID: 12345678.', { accepts: false }).canceled, true);
  assert.equal(attempt('ordinary', { readError: true }).canceled, true);
  assert.deepEqual(attempt('Customer ID: 12345678.', { trusted: false }).calls, []);
});

test('Enter and Send hold a typed draft with a misspelled customer ID until the protected retry', () => {
  for (const type of ['keydown', 'click', 'submit']) {
    const first = attempt('Cutomer id : 1234\nCusotmer id : 1234455\nInvest ₹25,000.', { type });
    assert.deepEqual(first.calls, ['cancel', 'stop', 'replace']);
    assert.equal(first.draft.match(/\[PV_CUSTOMER_ID_/g)?.length, 2);
    assert.doesNotMatch(first.draft, /: (?:1234|1234455)\b/);
    assert.match(first.draft, /₹25,000/);
    assert.equal(attempt(first.draft, { type }).canceled, false);
  }
});


test('a recognized provider click or form submit cannot bypass the draft scan when dispatched by the page', () => {
  for (const type of ['click', 'submit']) {
    const result = attempt('Customer ID: 12345678.', { trusted: false, type });
    assert.equal(result.canceled, true);
    assert.doesNotMatch(result.draft, /12345678/);
  }
});
