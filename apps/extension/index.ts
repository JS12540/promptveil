import { mountComposer } from '../../packages/ui/composer.ts';
import { insertIntoFocusedEditor } from './insert.ts';
import { scanPausePortName, waitForSendPause } from './scan-pause.ts';
import type { ChatScanPort } from './scan-pause.ts';
import { chatEditorSelectors } from './providers.ts';

interface Tab { id?: number; url?: string }
declare const chrome: {
  tabs: {
    query(query: object): Promise<Tab[]>;
    create(options: { url: string; openerTabId: number }): Promise<Tab>;
    connect(tabId: number, options: { name: string; frameId: number }): ChatScanPort;
  };
  runtime: { getURL(path: string): string };
  scripting: {
    executeScript(options: { target: { tabId: number }; func: typeof insertIntoFocusedEditor; args: Parameters<typeof insertIntoFocusedEditor> }): Promise<{ result: boolean }[]>;
  };
};

const sidePanel = location.pathname === '/panel.html';
const target = await chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0]).catch(() => undefined);
const selectors = chatEditorSelectors(target?.url);
const canTransfer = Boolean(target?.url?.startsWith('https://')) && (!sidePanel || selectors.length > 0);
const tabId = target?.id;
const needsSendPause = canTransfer && selectors.length > 0 && tabId !== undefined;
let previousDraft: string | undefined;
let sendIsPaused: (() => boolean) | undefined;

mountComposer({
  transferOnScan: canTransfer,
  pauseSend: needsSendPause ? async signal => {
    const port = chrome.tabs.connect(tabId, { name: scanPausePortName, frameId: 0 });
    const isPaused = await waitForSendPause(port, signal);
    if (!signal.aborted) sendIsPaused = isPaused;
    return isPaused;
  } : undefined,
  async insert(text) {
    const tab = target;
    const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined || !tab.url?.startsWith('https://') || current?.id !== tab.id || current.url !== tab.url) return false;
    if (!canTransfer || (needsSendPause && !sendIsPaused?.())) return false;
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [text, tab.url, selectors, previousDraft ?? ''],
      func: insertIntoFocusedEditor,
    });
    if (result?.result === true) {
      previousDraft = text;
      return true;
    }
    return false;
  },
});


const diagnostics = document.querySelector<HTMLButtonElement>('#open-guard-diagnostics');
if (diagnostics && tabId !== undefined) {
  diagnostics.addEventListener('click', async () => {
    const url = new URL(chrome.runtime.getURL('diagnostics.html'));
    url.searchParams.set('tab', String(tabId));
    try {
      await chrome.tabs.create({ url: url.href, openerTabId: tabId });
    } catch {
      const status = document.getElementById('diagnostics-open-status');
      if (status) status.textContent = 'Could not open diagnostics. Reopen PromptVeil from the chat tab and try again.';
    }
  });
} else if (diagnostics) {
  diagnostics.disabled = true;
}
