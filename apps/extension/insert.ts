// Chrome serializes this function before injecting it. Keep it independent of imports.
export function insertIntoFocusedEditor(protectedText: string, expectedUrl: string, selectors: string[] = [], previousDraft?: string) {
  if (location.href !== expectedUrl) return false;

  let focused = document.activeElement;
  while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;

  function editable(element: Element | null): HTMLElement | null {
    if (element instanceof HTMLTextAreaElement) return element.disabled || element.readOnly ? null : element;
    if (!(element instanceof HTMLElement) || !element.isContentEditable) return null;
    return element.closest<HTMLElement>('[contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable=""]');
  }

  const focusedEditor = editable(focused);
  let editor = focusedEditor;
  for (const selector of selectors) {
    const candidates = new Set(
      [...document.querySelectorAll(selector)].map(editable).filter((field): field is HTMLElement =>
        !!field && field.getClientRects().length > 0 && field.checkVisibility({ checkVisibilityCSS: true }),
      ),
    );
    if (candidates.size === 0) continue;
    if (focusedEditor && candidates.has(focusedEditor)) editor = focusedEditor;
    else if (candidates.size === 1) editor = candidates.values().next().value ?? null;
    else return false;
    break;
  }

  if (editor instanceof HTMLTextAreaElement) {
    if (previousDraft !== undefined && editor.value.trim() && editor.value !== previousDraft) return false;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setValue) return false;
    setValue.call(editor, protectedText);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  if (editor) {
    if (previousDraft !== undefined) {
      const current = editor.innerText.replace(/\r/g, '').trim();
      if (current && current !== previousDraft.replace(/\r/g, '').trim()) return false;
      editor.focus();
      const selection = document.getSelection();
      if (!selection) return false;
      const draft = document.createRange();
      draft.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(draft);
    } else {
      editor.focus();
    }
    return document.execCommand('insertText', false, protectedText);
  }

  return false;
}
