# Pause Send during a private composer scan

## Design

Native paste and pre-send scanning are synchronous. A browser input event cannot run in the middle of that JavaScript job. The private composer uses a worker and transfers approved text asynchronously. On configured chat sites it now opens a tab-scoped Chrome extension port and waits for acknowledgement before dispatching the scan. The content script cancels recognized Enter, Send, and form submission while a scan port is open. Ports carry control messages only. The pause persists through insertion and releases on completion, cancellation, scanner timeout, or loss of the page or composer connection. A canceled Enter or Send is discarded. [JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model) · [Chrome tab connections](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-connect) · [Chrome port lifetime](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#port-lifetime)

## Observed verification

- The delayed-worker fixture verified that scanning waits for acknowledgement, Enter is canceled in the private composer, and the connection stays held through transfer. Cancellation, a closed connection, and overlapping scans were checked.
- The built content script was run in a synthetic DOM fixture. It rejected an invalid sender, canceled Enter and form submission during the pause, and let a clean draft proceed after disconnect.
- Typecheck, 31 automated tests, the 500-prompt evaluation, build, and checksums passed. One unrelated socket test was skipped.
- The packaged Chromium smoke now checks Enter and Send clicks with a held port. Its syntax passed. Live sign-in browser verification remains pending.

[Session record](../sessions/PS-011.md) · [Paste and Send audit](chrome-send-guard.md)
