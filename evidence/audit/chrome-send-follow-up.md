# ChatGPT native paste and Send follow-up

The user again reported that synthetic identifiers stayed visible in the live draft. The screenshot shows a missed paste. It does not establish which extension build was loaded or what happened on Enter or Send. The screenshot contains account UI and is excluded from public evidence.

The launcher now shares the document-start bundle with the native guard and mounts after its handlers register. Its tooltip identifies the updated guard. The native guard handles a missed keyboard paste by examining the recognized draft when the paste action completes, and pauses Send if the paste result is still unresolved. ChatGPT Send checks cover Enter, the Send arrow's pointer and click events, and form submission. A pointer gesture that rewrites a draft also discards its matching click, so the same action cannot later send the rewritten draft. An identifiable ChatGPT Send arrow pauses if its editor cannot be resolved. Direct typing into ChatGPT remains visible to the provider page before the check. [Chrome document-start scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) · [Event propagation](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopImmediatePropagation) · [Form submission events](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/submit_event)

## Observed verification

- A packaged synthetic DOM fixture verified guard startup, missed-paste recovery of five identifiers, Enter cancellation while paste was pending, and the first pointer gesture being discarded after masking. It also verified a fresh Send was allowed after masking and an unresolved explicit ChatGPT Send was paused.
- Typecheck, 31 tests, the 500-prompt evaluation, build, and checksums passed. One unrelated loopback test was skipped. The browser fixture was syntax-checked. Live signed-in ChatGPT behavior remains unverified in this workspace.

[Session PS-012](../sessions/PS-012.md) · [Earlier Send audit](chrome-send-guard.md)
