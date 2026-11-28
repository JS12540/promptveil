# 04 · Test

The source CLI smoke covered benign amount preservation, customer-ID masking, value-free JSON findings, and synthetic credential blocking. See [PS-001](../sessions/PS-001.md) and the [compatibility run](../compatibility.md). Add integration summaries and CI URLs when available.

A later local `npm test` run on Node.js v26.0.0 reported 15 passing tests, no failures, and one skip. The mock request-handler streaming test ran in-process. Loopback binding was denied by the local sandbox, so the socket-based check remained skipped for that run. See [dated compatibility evidence](../compatibility.md).

The final Node suite passed 17 tests, with one true-loopback skip in the workspace sandbox. Both installed agent clients independently reported blocking via the real native hook. The benchmark passed its regression gates. [PS-002](../sessions/PS-002.md) · [Local run](../benchmarks/local-2026-11-24.json)

Verified website output and preview routes without Python on the executable path for the build. The workspace denied live loopback binding. [PS-003](../sessions/PS-003.md)

Verified the static landing and PWA entry point, 19 unit and fixture tests, native Claude Code and Codex blocking, and packaged Cursor hook behavior. [PS-004](../sessions/PS-004.md)

Reran fixture validation and packaging with the numeric identifiers. [PS-005](../sessions/PS-005.md)

Added direct transfer fixture coverage for focused plain and rich-text editors. See the [audit](../audit/chrome-extension.md) and [PS-006](../sessions/PS-006.md).

The one-step composer and draft-preservation cases passed locally. [Audit](../audit/chrome-one-step.md) · [PS-007](../sessions/PS-007.md)

Provider-origin and focused-editor fixtures passed. [Audit](../audit/chrome-providers.md) · [PS-008](../sessions/PS-008.md)

Native paste fixtures passed. Browser execution is tracked in the [paste audit](../audit/chrome-native-paste.md).

The packaged script verified the five-field paste and paused-send sequence in a synthetic DOM fixture. [PS-010](../sessions/PS-010.md)

The delayed-worker and packaged Send-pause fixtures passed. [Audit](../audit/chrome-scan-pause.md)

The packaged follow-up fixture passed startup, missed paste, and pointer gesture cases. [Audit](../audit/chrome-send-follow-up.md)

Packaged G4 diagnostics and provider-triggered Send handling passed in a synthetic DOM fixture. [Audit](../audit/chrome-live-bypass.md)

The packaged G5 guard passed synthetic typed-draft feedback and cancellation checks for Enter and the Send arrow. [Audit](../audit/chrome-typing-diagnostics.md) · [PS-014](../sessions/PS-014.md)

Generated single-edit variants, credential and PII fixtures, and four adapter protocols passed locally. [Audit](../audit/shared-scanner-coverage.md) · [PS-015](../sessions/PS-015.md)

Packaged worker and CLI smoke checks and a mock upstream confirmed that .env values are replaced in protected output. [Audit](../audit/file-output-redaction.md) · [PS-016](../sessions/PS-016.md)

Cross-language fixtures and packaged smoke checks exercised config, source, and structured environment redaction. [Audit](../audit/cross-language-redaction.md) · [PS-017](../sessions/PS-017.md)

The focused security suite verified relay rejection before upstream access and packaged release policy checks verified the extension permissions and browser content security policies. [PS-018](../sessions/PS-018.md)

Browser transfer and the historical synthetic PEM finding were investigated in [PS-021](../sessions/PS-021.md).
