import { findChatProvider } from './providers.ts';

declare const chrome: {
  runtime: {
    id: string;
    onMessage: {
      addListener(listener: (message: unknown, sender: { id?: string; url?: string; frameId?: number; tab?: { id?: number } }, respond: (opened: boolean) => void) => boolean | void): void;
    };
  };
  sidePanel: { open(options: { tabId: number }): Promise<void> };
};

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message !== 'promptveil:open-composer' || sender.id !== chrome.runtime.id ||
      sender.frameId !== 0 || sender.tab?.id === undefined || !findChatProvider(sender.url)) return;
  chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => respond(true), () => respond(false));
  return true;
});
