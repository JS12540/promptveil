import { guardBuild, guardDiagnosticsMessage } from './guard-diagnostics.ts';
import type { createGuardDiagnostics } from './guard-diagnostics.ts';

type GuardReport = ReturnType<ReturnType<typeof createGuardDiagnostics>['report']>;
declare const chrome: {
  tabs: { sendMessage(tabId: number, message: string, options: { frameId: number }): Promise<GuardReport | undefined> };
};

const tabId = Number(new URLSearchParams(location.search).get('tab'));
const refresh = document.querySelector<HTMLButtonElement>('#refresh-report')!;
const copy = document.querySelector<HTMLButtonElement>('#copy-report')!;
const status = document.getElementById('report-status')!;
const activity = document.getElementById('activity')!;
const summary = document.getElementById('guard-summary')!;
const events = document.getElementById('guard-events')!;
const report = document.getElementById('guard-report')!;

function renderActivity(data: GuardReport) {
  const fields = [
    ['Extension build', guardBuild],
    ['Chat guard build', data.build],
    ['Chat editor', data.editor ? 'Recognized' : 'Not found'],
    ['Send controls found', String(data.sendControls)],
    ['Send is paused', data.paused ? 'Yes' : 'No'],
    ['Typing scans flagged', `${data.typingScans.flagged} of ${data.typingScans.completed}`],
  ];
  summary.replaceChildren(...fields.map(([label, value]) => {
    const card = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    card.append(term, description);
    return card;
  }));
  events.replaceChildren(...(['paste', 'enter', 'send'] as const).map((name) => {
    const { seen, matched, canceled } = data.events[name];
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = name[0].toUpperCase() + name.slice(1);
    row.append(label);
    for (const count of [seen, matched, canceled]) row.insertCell().textContent = String(count);
    return row;
  }));
  activity.hidden = false;
}

async function refreshReport() {
  refresh.disabled = true;
  copy.disabled = true;
  status.textContent = 'Reading chat guard…';
  let data: GuardReport | undefined;
  let message: string;
  activity.hidden = true;
  try {
    if (!Number.isSafeInteger(tabId) || tabId < 1) throw new Error();
    data = await chrome.tabs.sendMessage(tabId, guardDiagnosticsMessage, { frameId: 0 });
    if (!data || data.guard !== 'running') throw new Error();
    if (data.build === guardBuild) {
      renderActivity(data);
      message = 'Guard running. The report contains only diagnostic metadata.';
    } else {
      message = 'The chat uses an older guard. Refresh the chat page, then refresh this report.';
    }
  } catch {
    message = 'No response from the chat guard. Refresh the chat page and check PromptVeil’s site access.';
  }
  report.textContent = JSON.stringify({ extensionBuild: guardBuild, tab: data ?? null, status: message }, null, 2);
  status.textContent = message;
  refresh.disabled = false;
  copy.disabled = false;
}

refresh.addEventListener('click', refreshReport);
copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(report.textContent ?? '');
    status.textContent = 'Diagnostic report copied.';
  } catch {
    (report.parentElement as HTMLDetailsElement).open = true;
    status.textContent = 'Could not copy automatically. Select and copy the raw report below.';
  }
});
void refreshReport();
