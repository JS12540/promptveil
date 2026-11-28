# 05 · Debug

Track genuine failures using a sanitized reproduction, confirmed cause, remediation, and rerun outcome. Add links to the session, relevant regression test, fix commit, and CI run when available.

During the initial local integration run, the scan-file assertion found no first finding and the native hook assertion disagreed with the Claude adapter's blocking response. A subsequent run included a labeled synthetic customer ID and matching adapter assertions. The scan-file and adapter tests passed. The socket integration remained separately skipped while the in-process handler test passed. See [test evidence](04-test.md) and [PS-001](../sessions/PS-001.md).

The 500-case evaluation exposed an account-number false positive in “Account number is optional for public records.” Requiring a digit in the detected identifier reduced benign modifications from 10% to 0% on that corpus. A gateway regression also demonstrated that scanning JSON keys and values separately missed the context of fields such as customer ID. The relay now carries recognized field context into scanning. [Benchmark](../benchmarks/README.md) · [Relay regression](../../tests/gateway.test.ts) · [PS-002](../sessions/PS-002.md)

A live screenshot showed a missed paste. Added paste-related input fallbacks and synchronous checks at recognized Send actions. [Follow-up audit](../audit/chrome-send-guard.md) · [PS-010](../sessions/PS-010.md)

Bundled guard and launcher from one entry point and added fallback recovery and pointer gesture cancellation after the repeated missed paste report. [PS-012](../sessions/PS-012.md)

User evidence confirmed live submission of an unmasked synthetic draft. G4 now exposes build identity and event matching to diagnose the failure. [Audit](../audit/chrome-live-bypass.md) · [PS-013](../sessions/PS-013.md)

Live G4 testing identified two customer ID label typos that escaped masking. G5 recognizes both, adds typing feedback, and moves diagnostics into a separate tab. [Audit](../audit/chrome-typing-diagnostics.md) · [PS-014](../sessions/PS-014.md)

Browser transfer and the historical synthetic PEM finding were investigated in [PS-021](../sessions/PS-021.md).
