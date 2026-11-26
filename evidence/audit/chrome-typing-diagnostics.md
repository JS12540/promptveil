# G5 native typing and diagnostics audit

## Observed in ChatGPT

The user’s G4 test showed that the guard was running and recognized the editor. Correctly spelled customer ID labels were masked. Two synthetic values sent under the misspelled labels `Cutomer id` and `Cusotmer id` remained visible. The diagnostics report displayed in a narrow toolbar popup. Chrome’s version and account configuration were unavailable for this observation.

## G5 changes

- The shared scanner recognizes a single insertion, deletion, substitution, or adjacent swap in the word “customer” when it appears in an explicit ID or number label.
- The native guard scans locally after a 220 ms pause in typing and shows feedback without interrupting edits. Enter and the Send control check the current draft synchronously. When a draft is masked, the first attempt is canceled and the user reviews the protected draft before retrying.
- The popup opens a diagnostics tab with the guard build, editor state, typing scan counts, and a table of observed and canceled events. The report contains no chat or clipboard text.

## Verification

- 15 focused tests passed, followed by 34 passing tests and one loopback skip in the full Node suite. Typecheck, build, and release checksum verification passed.
- The 500-case local synthetic evaluation passed with zero benign modifications and zero synthetic marker leaks. The balanced scanner p95 was 0.012 ms on Node v26.0.0 and macOS for this run. This measurement covers the scanner and excludes browser editing and rendering.
- A synthetic DOM fixture ran the packaged content script and checked typing feedback, Enter and pointer cancellation, clean retry, and metadata-only diagnostics.
- The Playwright browser fixture now exercises typed typos, paste, Enter, clicking Send, and the separate diagnostics page. This environment lacked Playwright. Live G5 verification in Chrome remains pending.

[Regression tests](../../tests/core.test.ts) · [Browser test](../../tests/e2e/browser.mjs) · [Manual steps](../../docs/install.md#debug-native-paste-or-send)
