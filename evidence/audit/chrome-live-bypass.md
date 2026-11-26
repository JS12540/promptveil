# Live ChatGPT bypass and G4 diagnostics

The user showed both an unmasked synthetic draft and the completed ChatGPT response. This confirms an unprotected submission in that browser run. The screenshots contain account UI and are excluded from the Evidence Pack. The supplied page-console warnings do not identify an error in PromptVeil's content script. The installed build and the browser's event sequence remain unconfirmed.

Build G4 adds a visible build marker, a tab-to-popup diagnostic response, and in-memory counts for seen, matched, and canceled events. It reports visible editor types and known Send-control counts. It retains no prompt, clipboard contents, account metadata, or page URLs. G4 also recognizes additional ChatGPT editor and Send-button forms and checks supported events dispatched by the provider page. [Chrome extension debugging](https://developer.chrome.com/docs/extensions/get-started/tutorial/debug) · [Chrome extension messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)

## Verification

- Typecheck, 32 tests, the 500-case synthetic evaluation, build, and checksum verification passed. One unrelated loopback test was skipped.
- The packaged G4 fixture verified launcher identity, rejection of another message sender, a metadata-only report, and cancellation and masking of a provider-triggered Send event.
- Signed-in Chrome is still unverified. The next diagnostic distinguishes missing G4 injection, an unmatched editor, an unobserved gesture, and a cancellation failure.

[Session record](../sessions/PS-013.md) · [Compatibility matrix](../../docs/compatibility.md)
