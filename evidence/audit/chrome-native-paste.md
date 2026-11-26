# Native chat paste protection audit

## Design

The W3C Clipboard API specifies that a native paste event fires before the browser inserts the clipboard data and can be canceled. Chrome supports an isolated content script at document start. PromptVeil installs a capture listener on the configured origins, matches recognized chat editors, cancels the original text paste and stops its propagation, and inserts only the approved plain text. The shared rules run synchronously within the extension's isolated content script. The scanner reads the text supplied by that paste event and uses no clipboard permission or network request. [W3C Clipboard API](https://www.w3.org/TR/clipboard-apis/#overriding-the-paste-event) · [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

Direct typing into the provider, pasted files, unsupported editors, and separate clipboard access remain outside this path. The private composer covers typing before protected transfer.

## Verification

- Node fixtures verified cancellation before reading and inserting, masking while preserving the amount, blocking credentials, pausing ambiguous findings, and leaving unrelated fields, untrusted events, and file-only pastes alone.
- Typecheck, 27 automated tests, the 500-prompt synthetic evaluation, package build, and checksum verification passed. The unrelated loopback test was skipped.
- The packaged Chromium test uses a native keyboard paste into a synthetic ChatGPT-shaped editor and checks that the page's later paste listener receives no event. It was syntax checked. Execution remains pending because Playwright is unavailable in this workspace.

## Chrome smoke check

Reload PromptVeil and refresh the supported chat tab. Copy and paste `Customer ID: 12345678. Invest ₹25,000.` directly into the native editor. Confirm the ID is masked before appearing, the amount is unchanged, and the draft stays unsent. Then paste `Password: never-valid-fixture` and verify the existing draft is unchanged. Record provider, browser version, and outcome.

[Session record](../sessions/PS-009.md) · [Provider compatibility](../../docs/compatibility.md)
