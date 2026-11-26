import type { Finding, Result, Review } from '../contracts/index.ts';

type Reply = Result | { restored: string };

export function mountComposer({ insert, transferOnScan = false, pauseSend, redact = false }: {
  insert?: (text: string) => Promise<boolean>;
  transferOnScan?: boolean;
  pauseSend?: (signal: AbortSignal) => Promise<() => boolean>;
  redact?: boolean;
} = {}) {
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const input = get<HTMLTextAreaElement>('input');
  const output = get<HTMLTextAreaElement>('output');
  const strict = get<HTMLInputElement>('strict');
  const config = document.getElementById('config-values') as HTMLInputElement | null;
  const scan = get<HTMLButtonElement>('scan');
  const copy = get<HTMLButtonElement>('copy');
  const send = get<HTMLButtonElement>('insert');
  const status = get('status');
  const review = get('review');
  const restore = get<HTMLTextAreaElement>('restore');
  const clear = get<HTMLButtonElement>('clear');
  const workerURL = new URL('./worker.ts', import.meta.url);
  let worker: Worker;
  let pending = false;
  let transferring = false;
  let scanLifetime: AbortController | undefined;
  let sendIsPaused: (() => boolean) | undefined;
  let timer = 0;
  let approved = '';
  let decisions: Review = {};
  if (transferOnScan) {
    scan.textContent = 'Protect and insert';
    const instructions = document.querySelector('header h1 + p');
    if (instructions) instructions.textContent = 'Write here, then place the protected draft in your chat.';
  }

  function clearOutput() {
    approved = '';
    output.value = '';
    copy.disabled = true;
    if (transferOnScan) copy.hidden = true;
    send.disabled = true;
  }

  function releaseSend() {
    scanLifetime?.abort();
    scanLifetime = undefined;
    sendIsPaused = undefined;
  }

  function fail() {
    worker.terminate();
    clearTimeout(timer);
    pending = false;
    releaseSend();
    scan.disabled = false;
    clearOutput();
    status.textContent = 'Local scan failed. Scan again to continue.';
    worker = newWorker();
  }

  function addReview(finding: Finding) {
    const label = document.createElement('label');
    label.textContent = `${finding.type}: ${input.value.slice(finding.start, finding.end)} `;
    const select = document.createElement('select');
    for (const [value, title] of [['', 'Choose a decision'], ['mask', 'Mask'], ['allow', 'Keep as written']]) {
      const option = new Option(title, value);
      select.add(option);
    }
    select.value = decisions[finding.start] ?? '';
    select.onchange = () => {
      if (select.value === 'mask' || select.value === 'allow') decisions[finding.start] = select.value;
      else delete decisions[finding.start];
    };
    label.append(select);
    review.append(label);
  }

  function newWorker() {
    const next = new Worker(workerURL, { type: 'module' });
    next.onerror = () => { if (next === worker && pending) fail(); };
    next.onmessage = async ({ data }: MessageEvent<Reply>) => {
      if ('restored' in data) { restore.value = data.restored; return; }
      if (!pending || next !== worker) return;
      if (sendIsPaused && !sendIsPaused()) {
        fail();
        status.textContent = 'The chat changed before the scan finished. Reopen PromptVeil in that chat.';
        return;
      }
      clearTimeout(timer);
      pending = false;
      scan.disabled = false;
      if (data.status !== 'ok' || !transferOnScan || !insert) releaseSend();
      if (data.status === 'ok') {
        approved = data.sanitizedText;
        output.value = approved;
        copy.disabled = false;
        send.disabled = !insert;
        status.textContent = data.findings.length ? 'Protected text is ready.' : 'Scan complete. No supported findings detected.';
        if (transferOnScan && insert) {
          transferring = true;
          input.disabled = strict.disabled = scan.disabled = clear.disabled = true;
          status.textContent = 'Inserting the protected draft…';
          try {
            const inserted = await insert(data.sanitizedText);
            copy.hidden = inserted;
            status.textContent = inserted
              ? 'Draft inserted. Review it in the chat before sending.'
              : 'Draft could not be inserted. Focus the empty chat editor and reopen PromptVeil, or copy the protected text.';
          } catch {
            copy.hidden = false;
            status.textContent = 'Draft could not be inserted. Reopen PromptVeil from the chat or copy the protected text.';
          } finally {
            transferring = false;
            releaseSend();
            input.disabled = strict.disabled = scan.disabled = clear.disabled = false;
          }
          return;
        }
      } else if (data.status === 'review') {
        for (const finding of data.findings.filter(item => item.action === 'review')) addReview(finding);
        status.textContent = 'Choose a decision for each finding, then try again.';
      } else {
        status.textContent = data.status === 'blocked' ? 'Transfer blocked by your protection policy.' : 'Scan could not complete. Try a shorter prompt.';
      }
    };
    return next;
  }

  worker = newWorker();
  function invalidate() {
    if (pending) {
      worker.terminate();
      worker = newWorker();
      clearTimeout(timer);
      pending = false;
      releaseSend();
      scan.disabled = false;
    }
    clearOutput();
    review.replaceChildren();
    decisions = {};
    status.textContent = '';
  }
  input.oninput = invalidate;
  strict.onchange = invalidate;
  if (config) config.onchange = invalidate;
  scan.onclick = async () => {
    if (pending || transferring) return;
    if (transferOnScan && !input.value.trim()) {
      status.textContent = 'Write a prompt first.';
      return;
    }
    clearOutput();
    review.replaceChildren();
    pending = true;
    scan.disabled = true;
    status.textContent = 'Scanning locally…';
    const lifetime = new AbortController();
    scanLifetime = lifetime;
    timer = window.setTimeout(fail, 2000);
    try {
      if (pauseSend) {
        const isPaused = await pauseSend(lifetime.signal);
        if (lifetime.signal.aborted) return;
        sendIsPaused = isPaused;
        if (!isPaused()) throw new Error('The chat is no longer connected.');
      }
      worker.postMessage({ text: input.value, strict: strict.checked, decisions, redact, config: config?.checked });
    } catch {
      if (lifetime.signal.aborted) return;
      fail();
      status.textContent = 'Could not pause Send. Refresh the chat tab and reopen PromptVeil.';
    }
  };
  if (transferOnScan) {
    input.onkeydown = event => {
      if (event.key !== 'Enter' || event.isComposing) return;
      if (pending || transferring) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.repeat) {
        event.preventDefault();
        scan.click();
      }
    };
  }
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(approved); status.textContent = 'Protected text copied.'; }
    catch { output.select(); status.textContent = 'Copy the selected protected text manually.'; }
  };
  copy.hidden = transferOnScan;
  send.hidden = !insert || transferOnScan;
  send.onclick = async () => {
    if (!insert || send.disabled) return;
    const text = approved;
    try { status.textContent = await insert(text) ? 'Inserted. Submit on the provider page when ready.' : 'Insertion unavailable. Use Copy protected text.'; }
    catch { status.textContent = 'Insertion unavailable. Use Copy protected text.'; }
  };
  get('restore-button').onclick = () => worker.postMessage({ restore: restore.value });
  clear.onclick = () => {
    invalidate();
    input.value = '';
    restore.value = '';
    worker.terminate();
    worker = newWorker();
  };
}
