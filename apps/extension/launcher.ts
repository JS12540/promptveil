import { guardBuild } from './guard-diagnostics.ts';

export function mountLauncher(openComposer: () => Promise<boolean>) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `Write with PromptVeil · ${guardBuild}`;
  button.title = 'PromptVeil Paste and Send guard is active';
  button.style.cssText = 'all: initial; position: fixed; top: 4.75rem; right: 1rem; z-index: 2147483647; font: 600 14px system-ui; padding: .55rem .8rem; color: #082a27; background: #7de8d5; cursor: pointer; border-radius: .5rem; box-shadow: 0 1px 7px #0004;';
  button.addEventListener('focus', () => { button.style.outline = '3px solid #005e73'; });
  button.addEventListener('blur', () => { button.style.outline = ''; });
  button.addEventListener('click', async event => {
    if (!event.isTrusted) return;
    const opened = await openComposer().catch(() => false);
    button.textContent = opened ? `Write with PromptVeil · ${guardBuild}` : 'Use the PromptVeil toolbar icon';
  });
  document.body.append(button);
}
