# Chrome paste and Send follow-up audit

## Reported failure

A user-provided live Chrome screenshot showed synthetic identifiers still visible in the ChatGPT draft after pasting. It establishes that the observed paste was unprotected. The exact event sequence and installed build could not be established from the screenshot. The screenshot includes account UI and is excluded from public evidence.

## Changes

- Retained capture of recognized native text pastes. Added cancellable paste-related beforeinput handling and a paste-input fallback for cases where the initial hook misses the edit.
- Added synchronous draft checks for recognized Enter, Send-button clicks, and form submission. Clean drafts keep their original send action. Maskable drafts are changed and require a fresh action. Detected credentials, unresolved findings, and scanner failures pause Send.
- The private composer still keeps raw typing outside the provider editor. Native Send checks cannot remove the provider page's earlier visibility into a raw draft. [W3C Input Events](https://www.w3.org/TR/input-events-2/) · [MDN submit event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event)

## Observed verification

- Typecheck, 29 tests, the 500-prompt evaluation, the release build, and checksums passed. One loopback test was skipped.
- The packaged script was executed in an isolated DOM fixture. A paste with five synthetic identifiers masked all five and preserved the amount. The first Enter redacted and paused the draft, the next accepted the clean draft, and a detected credential remained blocked.
- A 1,520-code-unit synthetic prompt with five identifiers took 0.015 ms p50 and 0.020 ms p95 across 1,500 local engine scans after 250 warm-up runs on Node.js v26.0.0. Timing bracketed the scanner call and excluded fixture assertions, browser event dispatch, layout, and editing.
- The packaged Chromium smoke was syntax-checked and covers native paste, Enter, and an SVG Send-button click. Live signed-in ChatGPT behavior remains pending.

[Session record](../sessions/PS-010.md) · [Original paste audit](chrome-native-paste.md)
