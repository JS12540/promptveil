import { protect } from '../../packages/core/index.ts';
import { chatPasteEditorSelectors } from './providers.ts';
import { createGuardDiagnostics, guardDiagnosticsMessage } from './guard-diagnostics.ts';
import { mountLauncher } from './launcher.ts';
import { guardChatSend } from './send.ts';
import { createSendPause, scanPausePortName } from './scan-pause.ts';
import type { ChatScanPort } from './scan-pause.ts';

declare const chrome: {
  runtime: {
    id: string;
    sendMessage(message: string): Promise<boolean>;
    getURL(path: string): string;
    onConnect: { addListener(listener: (port: ChatScanPort) => void): void };
    onMessage: {
      addListener(listener: (message: unknown, sender: { id?: string; url?: string }, respond: (result: unknown) => void) => void): void;
    };
  };
};

function chatEditor(target: unknown, selectors: string[]): HTMLElement | null {
  const element = target instanceof HTMLElement ? target : target instanceof Node ? target.parentElement : null;
  if (!element || element.closest('[aria-disabled="true"], [aria-readonly="true"]')) return null;
  const editor = element instanceof HTMLTextAreaElement
    ? element.disabled || element.readOnly ? null : element
    : element.isContentEditable
      ? element.closest<HTMLElement>('[contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable=""]')
      : null;
  if (!editor || !selectors.some(selector => editor.closest(selector) || element.closest(selector))) return null;
  return editor;
}

function editorFromInputEvent(event: Event, selectors: string[]) {
  const origin = chatEditor(event.composedPath()[0], selectors);
  if (origin || typeof document === 'undefined') return origin;
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return chatEditor(active, selectors);
}

function protectClipboard(
  event: Event,
  readText: () => string,
  insert: (text: string) => boolean,
  notify: (message: string) => void,
) {
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const text = readText();
    if (!text) {
      notify('Paste plain text or use the PromptVeil composer.');
      return;
    }
    const result = protect(text);
    if (result.status !== 'ok') {
      notify(result.status === 'review'
        ? 'Paste paused for review. Use the PromptVeil composer.'
        : result.status === 'blocked'
          ? 'PromptVeil blocked this paste.'
          : 'PromptVeil could not scan this paste.');
      return;
    }
    if (!insert(result.sanitizedText)) {
      notify('The chat editor could not accept a protected paste. Use the PromptVeil composer.');
      return;
    }
    if (result.findings.length) notify('PromptVeil pasted protected text.');
  } catch {
    notify('PromptVeil could not complete the paste. Use the PromptVeil composer.');
  }
}

export function handleChatPaste(
  event: ClipboardEvent,
  selectors: string[],
  insert: (text: string) => boolean,
  notify: (message: string) => void,
) {
  if (!event.isTrusted || !event.cancelable || event.defaultPrevented || !event.clipboardData || !selectors.length) return;
  if (!editorFromInputEvent(event, selectors)) return;
  const clipboard = event.clipboardData;
  if (!clipboard.types.some(type => type === 'text/plain' || type === 'text/html')) return;
  protectClipboard(event, () => clipboard.getData('text/plain'), insert, notify);
}

const sendButton = 'button#composer-submit-button, button[data-testid="send-button"], button[data-testid="send-message-button"], button[aria-label="Send" i], button[aria-label="Send message" i], button[aria-label="Send prompt" i], [role="button"][aria-label="Send prompt" i]';
const genericSubmit = 'button[type="submit"], input[type="submit"]';

function submittedEditor(target: unknown, selectors: string[]) {
  if (!(target instanceof Element)) return null;
  const button = target.closest<HTMLElement>(sendButton + ', ' + genericSubmit);
  if (button?.matches('[disabled], [aria-disabled="true"], [data-testid="stop-button"], [aria-label^="Stop" i]')) return null;
  const form = target instanceof HTMLFormElement ? target : button?.closest('form');
  if (!form && !button?.matches(sendButton)) return null;
  const roots = form && button?.matches(sendButton) ? [form, document] : [form ?? document];
  for (const root of roots) {
    for (const selector of selectors) {
      const matches = [...root.querySelectorAll(selector)]
        .map(match => chatEditor(match, selectors))
        .filter((editor): editor is HTMLElement => Boolean(editor?.getClientRects().length));
      const unique = new Set(matches);
      if (unique.size === 1) return matches[0];
      if (unique.size > 1) return null;
    }
  }
  return null;
}

if (typeof window !== 'undefined') {
  const sendPause = createSendPause();
  const diagnostics = createGuardDiagnostics();
  const isComposer = (url?: string) => url === chrome.runtime.getURL('panel.html') || url === chrome.runtime.getURL('index.html');
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== scanPausePortName || port.sender?.id !== chrome.runtime.id) return;
    if (isComposer(port.sender?.url)) sendPause.attach(port);
  });

  let notice: HTMLDivElement | undefined;
  let dismiss: number | undefined;
  let writing = false;
  let blockedEnter = false;
  let blockedPointer = false;
  let pendingPaste: { editor: HTMLElement; timer: number } | undefined;
  let typingTimer: number | undefined;
  const notify = (message: string) => {
    notice?.remove();
    window.clearTimeout(dismiss);
    notice = document.createElement('div');
    notice.role = 'status';
    notice.setAttribute('aria-live', 'polite');
    notice.style.cssText = 'position:fixed;top:8rem;right:1rem;z-index:2147483647;max-width:19rem;padding:.75rem 1rem;border-radius:.55rem;background:#0a1423;color:#e8f3fb;font:600 14px system-ui;box-shadow:0 2px 12px #0005;pointer-events:none;';
    document.body.append(notice);
    notice.textContent = message;
    dismiss = window.setTimeout(() => notice?.remove(), 4500);
  };

  const selectors = () => chatPasteEditorSelectors(location.href);
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message !== guardDiagnosticsMessage || sender.id !== chrome.runtime.id) return;
    const rules = selectors();
    const fields = [...document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')]
      .filter(field => field.getClientRects().length > 0).slice(0, 8);
    const visible = fields.map(field => {
      const tag = field instanceof HTMLTextAreaElement ? 'textarea' : 'rich-text';
      return tag + (chatEditor(field, rules) ? ' (matched)' : ' (unmatched)');
    });
    respond(diagnostics.report(visible.some(field => field.endsWith(' (matched)')), document.querySelectorAll(sendButton).length, sendPause.active || !!pendingPaste || writing, visible));
  });
  const pasteInput = (event: InputEvent) => event.inputType === 'insertFromPaste' || event.inputType === 'insertFromPasteAsQuotation';
  const draftText = (editor: HTMLElement) => editor instanceof HTMLTextAreaElement ? editor.value : editor.innerText;
  function scheduleTypingCheck(editor: HTMLElement) {
    window.clearTimeout(typingTimer);
    typingTimer = window.setTimeout(() => {
      if (!editor.isConnected) return;
      let message: string | undefined;
      try {
        const result = protect(draftText(editor));
        if (result.status === 'ok' && result.findings.length) {
          message = 'Sensitive text detected. Enter or Send will protect the draft and hold it for review.';
        } else if (result.status !== 'ok') {
          message = 'This draft needs attention. Enter or Send will check it before submitting.';
        }
      } catch {
        message = 'PromptVeil could not check this draft. Review it before sending.';
      }
      diagnostics.recordTypingScan(Boolean(message));
      if (message) notify(message);
    }, 220);
  }
  function insertText(text: string) {
    writing = true;
    try { return document.execCommand('insertText', false, text); }
    finally { writing = false; }
  }
  function replaceDraft(editor: HTMLElement, text: string) {
    editor.focus();
    if (editor instanceof HTMLTextAreaElement) {
      editor.select();
    } else {
      const selection = editor.ownerDocument.getSelection();
      if (!selection) return false;
      const range = editor.ownerDocument.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return insertText(text);
  }

  function clearPendingPaste() {
    if (!pendingPaste) return;
    window.clearTimeout(pendingPaste.timer);
    pendingPaste = undefined;
  }

  function protectEditedDraft(editor: HTMLElement, suppressInput?: () => void) {
    try {
      const original = draftText(editor);
      const result = protect(original);
      if (result.status === 'ok' && result.sanitizedText === original) return;
      suppressInput?.();
      if (result.status === 'ok' && replaceDraft(editor, result.sanitizedText)) {
        notify('PromptVeil protected the pasted draft.');
        return;
      }
    } catch {
      suppressInput?.();
    }
    notify('PromptVeil flagged this draft. Review it before sending.');
  }

  window.addEventListener('paste', event => {
    const rules = selectors();
    const matched = !!editorFromInputEvent(event, rules);
    if (matched && event.isTrusted) window.clearTimeout(typingTimer);
    handleChatPaste(event, rules, insertText, notify);
    if (event.isTrusted) diagnostics.record('paste', matched, event.defaultPrevented);
    if (event.defaultPrevented) clearPendingPaste();
  }, { capture: true });

  window.addEventListener('beforeinput', event => {
    const input = event as InputEvent;
    if (writing || !input.isTrusted || !input.cancelable || input.defaultPrevented || !pasteInput(input)) return;
    if (!editorFromInputEvent(input, selectors())) return;
    window.clearTimeout(typingTimer);
    const text = input.dataTransfer?.getData('text/plain') || input.data;
    if (typeof text === 'string' && text) {
      protectClipboard(input, () => text, insertText, notify);
      clearPendingPaste();
    }
  }, { capture: true });

  window.addEventListener('input', event => {
    const input = event as InputEvent;
    if (writing || !input.isTrusted) return;
    const editor = editorFromInputEvent(input, selectors());
    if (!editor) return;
    if (input.isComposing) {
      window.clearTimeout(typingTimer);
      return;
    }
    if (pendingPaste?.editor !== editor && !pasteInput(input) && (input.data?.length ?? 0) < 16) {
      scheduleTypingCheck(editor);
      return;
    }
    window.clearTimeout(typingTimer);
    clearPendingPaste();
    protectEditedDraft(editor, () => input.stopImmediatePropagation());
  }, { capture: true });

  window.addEventListener('keydown', event => {
    if (!event.isTrusted || event.isComposing || event.keyCode === 229) return;
    const pasteShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v';
    if (!pasteShortcut && (event.key !== 'Enter' || event.shiftKey || event.altKey)) return;
    const editor = editorFromInputEvent(event, selectors());
    if (!editor) {
      if (!pasteShortcut) diagnostics.record('enter', false, false);
      return;
    }
    if (pasteShortcut) {
      clearPendingPaste();
      pendingPaste = { editor, timer: window.setTimeout(() => {
        clearPendingPaste();
        if (editor.isConnected) protectEditedDraft(editor);
      }, 350) };
      return;
    }
    if (event.repeat) {
      blockedEnter = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    window.clearTimeout(typingTimer);
    guardChatSend(event, () => draftText(editor), text => replaceDraft(editor, text), notify, sendPause.active || writing || !!pendingPaste);
    blockedEnter = event.defaultPrevented;
    diagnostics.record('enter', true, event.defaultPrevented);
  }, { capture: true });

  window.addEventListener('keyup', event => {
    if (event.isTrusted && event.key.toLowerCase() === 'v' && pendingPaste) {
      const editor = pendingPaste.editor;
      clearPendingPaste();
      if (editor.isConnected) protectEditedDraft(editor);
    }
    if (event.key !== 'Enter' || !event.isTrusted || !blockedEnter) return;
    blockedEnter = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });

  function checkSubmission(event: Event) {
    if (!event.cancelable || event.defaultPrevented || (!event.isTrusted && event.type !== 'click' && event.type !== 'submit')) return;
    const target = event.composedPath()[0];
    const editor = submittedEditor(target, selectors());
    const button = target instanceof Element ? target.closest(sendButton) : null;
    const explicitChatGptSend = location.hostname === 'chatgpt.com' &&
      button?.matches('#composer-submit-button, [data-testid="send-button"], [aria-label="Send prompt" i]') &&
      !button.matches('[disabled], [aria-disabled="true"], [data-testid="stop-button"], [aria-label^="Stop" i]');
    if (!editor && !explicitChatGptSend) {
      if (button || event.type === 'submit') diagnostics.record('send', false, false);
      return;
    }
    if (event.type === 'click' && (event as MouseEvent).detail > 0 && blockedPointer) {
      blockedPointer = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      diagnostics.record('send', true, true);
      return;
    }
    window.clearTimeout(typingTimer);
    guardChatSend(event, () => {
      if (!editor) throw new Error('Chat editor could not be identified.');
      return draftText(editor);
    }, text => !!editor && replaceDraft(editor, text), notify, sendPause.active || writing || !!pendingPaste);
    diagnostics.record('send', !!editor, event.defaultPrevented);
  }
  window.addEventListener('pointerdown', event => {
    if (!event.isTrusted || event.button !== 0) return;
    blockedPointer = false;
    checkSubmission(event);
    blockedPointer = event.defaultPrevented;
  }, { capture: true });
  window.addEventListener('pointercancel', () => { blockedPointer = false; }, { capture: true });
  window.addEventListener('click', checkSubmission, { capture: true });
  window.addEventListener('submit', checkSubmission, { capture: true });

  const showLauncher = () => mountLauncher(() => chrome.runtime.sendMessage('promptveil:open-composer'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showLauncher, { once: true });
  else showLauncher();
}
