export const scanPausePortName = 'promptveil:pause-send';

export interface ChatScanPort {
  name: string;
  sender?: { id?: string; url?: string };
  onMessage: { addListener(listener: (message: unknown) => void): void };
  onDisconnect: { addListener(listener: () => void): void };
  postMessage(message: unknown): void;
  disconnect(): void;
}

export function createSendPause() {
  const ports = new Set<ChatScanPort>();
  return {
    get active() { return ports.size > 0; },
    attach(port: ChatScanPort) {
      ports.add(port);
      const remove = () => { ports.delete(port); };
      port.onDisconnect.addListener(remove);
      try { port.postMessage(true); }
      catch { remove(); }
    },
  };
}

export function waitForSendPause(port: ChatScanPort, signal: AbortSignal): Promise<() => boolean> {
  return new Promise((resolve, reject) => {
    let connected = true;
    const disconnected = () => {
      connected = false;
      signal.removeEventListener('abort', abort);
      reject(new Error('The chat tab is no longer connected.'));
    };
    const abort = () => {
      if (!connected) return;
      disconnected();
      port.disconnect();
    };
    port.onDisconnect.addListener(disconnected);
    port.onMessage.addListener(message => {
      if (message === true && connected) resolve(() => connected && !signal.aborted);
    });
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
