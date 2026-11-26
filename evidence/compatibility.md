# Dated compatibility checks

The [published compatibility matrix](../docs/compatibility.md) records current support and outstanding checks.

## 2026-11-24 UTC

| Run | Observed |
| --- | --- |
| CLI from source on macOS, Node.js v26.0.0 | A mixed ID and amount prompt masked the ID and preserved the amount. Standalone investment amount stayed intact. JSON findings carried offsets and type without the matched value. Synthetic credential resulted in a block and exit code 2. |
| Packaged CLI smoke | Installed the local tarball offline into a clean npm prefix, then ran the packaged executable. It masked the synthetic customer ID and preserved the currency amount. |
| Local agent versions | Codex CLI 0.172.0 and Claude Code 2.1.331 were present. Version output alone does not verify hook or relay behavior. |

[Session PS-001](sessions/PS-001.md)

The later local fixture run passed 15 tests, with one socket-based test skipped because the sandbox denied loopback binding. The in-process relay handler sanitized model-bound traffic and streamed the mocked upstream response. This evidence covers the exercised handler and fixtures. The live Codex relay check remains pending.

| Run | Observed |
| --- | --- |
| Claude Code 2.1.331 | The real client in isolated print mode reported UserPromptSubmit blocking with the installed hook. The host echoed the original synthetic prompt locally and returned exit code 0. |
| Codex CLI 0.172.0 | The real client in an isolated synthetic configuration reported UserPromptSubmit blocking. The one-off smoke allowed the test's isolated, known hook definition. The host echoed the synthetic prompt locally and returned exit code 0. |
| Local relay and browser integration | Socket-free relay tests exercised SSE, denied forwarding, and cancellation. The sandbox denied loopback binding, so actual Codex relay and browser integration remain unverified. |

[Session PS-002](sessions/PS-002.md)
