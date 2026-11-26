export const guardBuild = 'G7';
export const guardDiagnosticsMessage = 'promptveil:guard-diagnostics';

export function createGuardDiagnostics() {
  const events = {
    paste: { seen: 0, matched: 0, canceled: 0 },
    enter: { seen: 0, matched: 0, canceled: 0 },
    send: { seen: 0, matched: 0, canceled: 0 },
  };
  let last: { event: keyof typeof events; matched: boolean; canceled: boolean } | undefined;
  const typingScans = { completed: 0, flagged: 0 };
  return {
    recordTypingScan(flagged: boolean) {
      typingScans.completed++;
      if (flagged) typingScans.flagged++;
    },
    record(event: keyof typeof events, matched: boolean, canceled: boolean) {
      events[event].seen++;
      if (matched) events[event].matched++;
      if (canceled) events[event].canceled++;
      last = { event, matched, canceled };
    },
    report(editor: boolean, sendControls: number, paused: boolean, editableFields: string[]) {
      return { build: guardBuild, guard: 'running', editor, sendControls, paused, editableFields, typingScans, events, last: last ?? null };
    },
  };
}
