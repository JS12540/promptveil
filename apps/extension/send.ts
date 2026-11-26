import { protect } from '../../packages/core/index.ts';

export function guardChatSend(event: Event, readDraft: () => string, replaceDraft: (text: string) => boolean, notify: (message: string) => void, paused = false) {
  if (!event.cancelable || event.defaultPrevented || (!event.isTrusted && event.type !== 'click' && event.type !== 'submit')) return;
  const cancel = () => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  if (paused) {
    cancel();
    notify('PromptVeil is checking the draft. Press Send again when it finishes.');
    return;
  }
  try {
    const original = readDraft();
    const result = protect(original);
    if (result.status === 'ok' && result.sanitizedText === original) return;
    cancel();
    if (result.status === 'ok') {
      notify(replaceDraft(result.sanitizedText)
        ? 'PromptVeil protected the draft. Review it, then press Send again.'
        : 'Send paused. Open PromptVeil to protect this draft.');
    } else {
      notify(result.status === 'review'
        ? 'Send paused for review. Open PromptVeil before sending.'
        : result.status === 'blocked'
          ? 'PromptVeil blocked Send. Remove the detected credential and try again.'
          : 'Send paused. PromptVeil could not scan this draft.');
    }
  } catch {
    cancel();
    notify('Send paused. PromptVeil could not scan this draft.');
  }
}
