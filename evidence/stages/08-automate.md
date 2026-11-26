# 08 · Automate

Use the [testing procedure](../../docs/testing.md) and [release workflow](../../docs/releasing.md) to reproduce local checks. Add workflow versions and observed CI runs when available.

The repository contains the required verification workflow, scheduled runtime compatibility checks, and protected release/Pages workflow. Local build, typecheck, fixture evaluation, and checksums passed. Hosted Actions results are pending. [Verification workflow](../../.github/workflows/ci.yml) · [Release workflow](../../.github/workflows/release.yml) · [PS-002](../sessions/PS-002.md)

The security workflows add focused privacy regressions, lockfile auditing, static analysis, and tagged release provenance. YAML, shell syntax, and action pins passed local checks. Hosted scans and attestations are pending. [CodeQL workflow](../../.github/workflows/codeql.yml) · [PS-018](../sessions/PS-018.md)
