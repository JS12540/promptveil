# PromptVeil Codex Evidence Pack

**Release status** · Prerelease worktree. Add the public repository, tagged release, deployed PWA, and demo links after publication.

PromptVeil applies local rules to mask supported identifiers and stop detected credentials before sending prompts to AI tools. The initial CLI smoke verified the synthetic customer-ID, ordinary investment amount, and blocked-credential cases. See the [session index](sessions.csv), [compatibility run log](compatibility.md), and [benchmark records](benchmarks/README.md) for observed evidence.

## Lifecycle and rubric

| Stage | Evidence |
| --- | --- |
| Understand | [Problem, alternatives, and scope](stages/01-understand.md) |
| Plan | [Architecture and release gates](stages/02-plan.md) |
| Build | [Implementation and verification](stages/03-build.md) |
| Test | [Fixture and integration checks](stages/04-test.md) |
| Debug | [Observed failures and fixes](stages/05-debug.md) |
| Optimize | [Measured improvements and benchmarks](stages/06-optimize.md) |
| Ship | [Artifacts, deployment, and install checks](stages/07-ship.md) |
| Automate | [CI and reproducible workflows](stages/08-automate.md) |

- **Capability and model/effort choices.** Start with the [session index](sessions.csv), the [repository documentation session](sessions/PS-001.md), and the [prerelease implementation session](sessions/PS-002.md). Add one model or effort comparison on comparable real tasks when available.
- **Engineering quality.** Follow the [testing procedure](../docs/testing.md), [compatibility run log](compatibility.md), and [release checklist](submission-checklist.md).
- **Originality and attribution.** Context-aware protection for supported formats is shared by the browser, CLI, and relay. See [architecture](../docs/architecture.md), [decisions](../docs/decisions/README.md), and [NOTICE](../NOTICE).
- **Known limitations.** See the [threat model](../docs/threat-model.md) and [canonical compatibility matrix](../docs/compatibility.md).

## Collection workflow

For substantive work, create an issue, select model and effort, run Codex, review changes, verify, record results, commit, and update the index. Reserve 5–10 minutes per work block for evidence. Link actual commits and CI when available. Audit links, pending claims, and accidental disclosure after each work block and before release.

[Chrome extension transfer audit](audit/chrome-extension.md) records fixture results and the live-site checklist.

[One-step Chrome composer audit](audit/chrome-one-step.md) records the updated workflow and fixture results.

[Chrome chat provider audit](audit/chrome-providers.md) records configured websites and observed verification.

[Native chat paste audit](audit/chrome-native-paste.md) records research and verification.

[Native paste and Send follow-up](audit/chrome-send-guard.md) records the reported miss, safeguards, and latency measurements.

[Scan-pause audit](audit/chrome-scan-pause.md) records Send behavior during an asynchronous scan.

[ChatGPT Send follow-up audit](audit/chrome-send-follow-up.md) tracks the repeated live report and packaged validation.

[Live ChatGPT bypass and G4 diagnostics](audit/chrome-live-bypass.md) records the confirmed failure and the diagnostic plan.

[G5 typing and diagnostics audit](audit/chrome-typing-diagnostics.md) records the misspelled-label regression, packaged checks, and live verification status.

[G6 shared scanner audit](audit/shared-scanner-coverage.md) records the expanded evaluation and terminal hook coverage.

[PWA and terminal output redaction audit](audit/file-output-redaction.md) records the packaged and relay verification.

[Cross-language redaction audit](audit/cross-language-redaction.md) records configuration and source coverage.
